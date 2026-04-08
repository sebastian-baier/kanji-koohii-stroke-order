// ==UserScript==
// @name         Kanji Koohii – Stroke Order (KanjiVG)
// @namespace    https://kanji.koohii.com/
// @version      1.0.0
// @description  Shows stroke order diagrams on Kanji Koohii using KanjiVG
// @author       sebastian-baier
// @homepageURL  https://github.com/sebastian-baier/kanji-koohii-stroke-order
// @downloadURL  https://raw.githubusercontent.com/sebastian-baier/kanji-koohii-stroke-order/main/kanji_koohii_stroke_order.user.js
// @include      http://kanji.koohii.com/study/kanji/*
// @include      https://kanji.koohii.com/study/kanji/*
// @include      http://kanji.koohii.com/review*
// @include      https://kanji.koohii.com/review*
// @include      http://staging.koohii.com/study/kanji/*
// @include      https://staging.koohii.com/study/kanji/*
// @include      http://staging.koohii.com/review*
// @include      https://staging.koohii.com/review*
// @match        https://kanji.koohii.com/*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function () {
  'use strict'

  // ─── Config ───────────────────────────────────────────────────────────────

  const KANJIVG_URL = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/'
  const STROKE_COLORS = [
    '#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#2980b9',
    '#8e44ad', '#16a085', '#d35400', '#1abc9c', '#9b59b6'
  ]
  const POLL_INTERVAL_MS = 200
  const POLL_MAX_ATTEMPTS = 20

  // ─── Unicode helpers ──────────────────────────────────────────────────────

  function charToUnicodeHex (char) {
    return char.codePointAt(0).toString(16).padStart(5, '0')
  }

  function isKanjiChar (char) {
    const codePoint = char.codePointAt(0)
    return (codePoint >= 0x4E00 && codePoint <= 0x9FFF) // CJK Unified Ideographs
      || (codePoint >= 0x3400 && codePoint <= 0x4DBF) // CJK Extension A
      || (codePoint >= 0xF900 && codePoint <= 0xFAFF) // CJK Compatibility
      || (codePoint >= 0x20000 && codePoint <= 0x2A6DF) // CJK Extension B
  }

  // ─── KanjiVG fetching ─────────────────────────────────────────────────────

  function fetchStrokeOrderSVG (kanjiChar) {
    const url = KANJIVG_URL + charToUnicodeHex(kanjiChar) + '.svg'

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        onload: (response) => response.status === 200 ? resolve(response.responseText) : reject(),
        onerror: reject
      })
    })
  }

  // ─── SVG processing ───────────────────────────────────────────────────────

  function parseSVGString (svgText) {
    return new DOMParser().parseFromString(svgText, 'image/svg+xml').querySelector('svg')
  }

  function colorizeStrokes (svgElement) {
    const strokePaths = [...svgElement.querySelectorAll('path')]

    strokePaths.forEach((path, index) => {
      path.setAttribute('stroke', STROKE_COLORS[index % STROKE_COLORS.length])
      path.setAttribute('stroke-width', '3')
      path.setAttribute('fill', 'none')
    })

    return strokePaths.length
  }

  function styleStrokeNumbers (svgElement) {
    svgElement.querySelectorAll('text').forEach(label => {
      label.setAttribute('fill', '#444')
      label.style.fontSize = '8px'
    })
  }

  function prepareStrokeOrderSVG (svgElement) {
    svgElement.setAttribute('viewBox', '0 0 109 109')
    svgElement.removeAttribute('width')
    svgElement.removeAttribute('height')

    const strokeCount = colorizeStrokes(svgElement)
    styleStrokeNumbers(svgElement)

    return strokeCount
  }

  // ─── DOM building ─────────────────────────────────────────────────────────

  function buildStrokeBoxElement (kanjiChar, svgText) {
    const container = document.createElement('div')
    container.className = 'kko-stroke-box'

    const svgElement = parseSVGString(svgText)
    if (!svgElement) {
      container.innerHTML = `<span class="kko-error">${kanjiChar} (?)</span>`
      return container
    }

    const strokeCount = prepareStrokeOrderSVG(svgElement)
    container.appendChild(svgElement)

    const strokeLabel = document.createElement('span')
    strokeLabel.className = 'kko-stroke-label'
    strokeLabel.textContent = `${kanjiChar} · ${strokeCount} strokes`
    container.appendChild(strokeLabel)

    return container
  }

  function buildStrokeSection () {
    const section = document.createElement('div')
    section.className = 'kko-stroke-section'

    const heading = document.createElement('h4')
    heading.textContent = 'Stroke order'
    section.appendChild(heading)

    const row = document.createElement('div')
    row.className = 'kko-stroke-row'
    section.appendChild(row)

    return { section, row }
  }

  // ─── Injection ────────────────────────────────────────────────────────────

  async function injectStrokeOrderSection (kanjiChars, anchorElement) {
    const alreadyInjected = document.querySelector('.kko-stroke-section')
    if (alreadyInjected) return

    const { section, row } = buildStrokeSection()
    anchorElement.insertAdjacentElement('afterend', section)

    for (const char of kanjiChars) {
      try {
        const svgText = await fetchStrokeOrderSVG(char)
        const strokeBox = buildStrokeBoxElement(char, svgText)
        row.appendChild(strokeBox)
      } catch {
        const errorSpan = document.createElement('span')
        errorSpan.className = 'kko-error'
        errorSpan.textContent = `${char} (no data)`
        row.appendChild(errorSpan)
      }
    }
  }

  function tryFindAndInject () {
    // Koohii renders the kanji inside: div.kanji > span.cj-k
    const kanjiSpan = document.querySelector('.kanji .cj-k, .kanji span[lang="ja"]')
    if (!kanjiSpan) return false

    const kanjiChars = [...kanjiSpan.textContent.trim()].filter(isKanjiChar)
    if (!kanjiChars.length) return false

    // Anchor: .rtkframe = the panel containing frame number, kanji, and readings
    const studyFrame = kanjiSpan.closest('.rtkframe')
    if (!studyFrame) return false

    injectStrokeOrderSection(kanjiChars, studyFrame)
    return true
  }

  // ─── Styles ───────────────────────────────────────────────────────────────

  function injectStyles () {
    const styleTag = document.createElement('style')
    styleTag.textContent = `
      .kko-stroke-section {
        background: #f8f7f2;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 10px 14px;
        margin: 14px 0;
      }
      .kko-stroke-section h4 {
        margin: 0 0 8px;
        font-size: 12px;
        color: #888;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .kko-stroke-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: flex-start;
      }
      .kko-stroke-box {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .kko-stroke-box svg {
        width: 130px;
        height: 130px;
        border: 1px solid #ccc;
        border-radius: 6px;
        background: #fff;
        display: block;
      }
      .kko-stroke-label {
        font-size: 11px;
        color: #888;
        margin-top: 4px;
      }
      .kko-error {
        font-size: 12px;
        color: #aaa;
      }
    `
    document.head.appendChild(styleTag)
  }

  // ─── Entry point ──────────────────────────────────────────────────────────

  function init () {
    injectStyles()

    // Koohii uses Vue — the DOM may not be ready right after DOMContentLoaded,
    // so we poll until the kanji element appears.
    if (!tryFindAndInject()) {
      let attempts = 0
      const poller = setInterval(() => {
        const success = tryFindAndInject()
        const tooManyTries = ++attempts >= POLL_MAX_ATTEMPTS
        if (success || tooManyTries) clearInterval(poller)
      }, POLL_INTERVAL_MS)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
