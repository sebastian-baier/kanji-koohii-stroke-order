// ==UserScript==
// @name         Kanji Koohii – Stroke Order (KanjiVG)
// @namespace    https://kanji.koohii.com/
// @version      2.0.2
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

  // ─── Page detection ───────────────────────────────────────────────────────

  function isReviewPage () {
    return window.location.pathname.startsWith('/review')
  }

  function isStudyPage () {
    return window.location.pathname.startsWith('/study/kanji')
  }

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

  function addArrowMarkers (svgElement) {
    const defs = svgElement.querySelector('defs') || svgElement.insertBefore(
      document.createElementNS('http://www.w3.org/2000/svg', 'defs'),
      svgElement.firstChild
    )

    STROKE_COLORS.forEach((color, index) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker')
      marker.setAttribute('id', `kko-arrow-${index}`)
      marker.setAttribute('markerWidth', '6')
      marker.setAttribute('markerHeight', '6')
      marker.setAttribute('refX', '3')
      marker.setAttribute('refY', '3')
      marker.setAttribute('orient', 'auto')

      const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      arrowPath.setAttribute('d', 'M0,0 L0,6 L6,3 z')
      arrowPath.setAttribute('fill', color)
      marker.appendChild(arrowPath)
      defs.appendChild(marker)
    })
  }

  function colorizeStrokes (svgElement) {
    addArrowMarkers(svgElement)

    const strokePaths = [...svgElement.querySelectorAll('path')]

    strokePaths.forEach((path, index) => {
      const colorIndex = index % STROKE_COLORS.length
      path.setAttribute('stroke', STROKE_COLORS[colorIndex])
      path.setAttribute('stroke-width', '3')
      path.setAttribute('fill', 'none')
      path.setAttribute('marker-end', `url(#kko-arrow-${colorIndex})`)
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

  function removeExistingStrokeSection () {
    document.querySelector('.kko-stroke-section')?.remove()
  }

  async function injectStrokeOrderSection (kanjiChars, anchorElement) {
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

  // ─── Study page ───────────────────────────────────────────────────────────

  // Kanji is inside: div.kanji > span.cj-k
  // Anchor: .rtkframe = panel with frame number, kanji, and readings

  function tryInjectOnStudyPage () {
    const kanjiSpan = document.querySelector('.kanji .cj-k, .kanji span[lang="ja"]')
    if (!kanjiSpan) return false

    const kanjiChars = [...kanjiSpan.textContent.trim()].filter(isKanjiChar)
    if (!kanjiChars.length) return false

    const studyFrame = kanjiSpan.closest('.rtkframe')
    if (!studyFrame) return false

    injectStrokeOrderSection(kanjiChars, studyFrame)
    return true
  }

  function initStudyPage () {
    if (!tryInjectOnStudyPage()) {
      let attempts = 0
      const poller = setInterval(() => {
        const success = tryInjectOnStudyPage()
        const tooManyTries = ++attempts >= POLL_MAX_ATTEMPTS
        if (success || tooManyTries) clearInterval(poller)
      }, POLL_INTERVAL_MS)
    }
  }

  // ─── Review page ──────────────────────────────────────────────────────────

  // The flashcard flips by toggling between uiFcState-0 (unflipped) and
  // uiFcState-1 (flipped). Vue may update the card in place or replace the
  // element entirely, so we use a single persistent observer on #uiFcMain
  // that reacts to any attribute or DOM change. We track the last kanji we
  // injected so we never inject the same one twice in a row.

  function getFlashcardKanjiChars (flashcard) {
    // Use .d-kanji to avoid picking up 画数 from the stroke count label
    const kanjiSpan = flashcard.querySelector('.d-kanji .cj-k span')
    if (!kanjiSpan) return []
    return [...kanjiSpan.textContent.trim()].filter(isKanjiChar)
  }

  function isCardFlipped (flashcard) {
    return flashcard.classList.contains('uiFcState-1')
  }

  function initReviewPage () {
    let attempts = 0
    const poller = setInterval(() => {
      const reviewContainer = document.querySelector('#uiFcMain')
      if (!reviewContainer) {
        if (++attempts >= POLL_MAX_ATTEMPTS) clearInterval(poller)
        return
      }

      clearInterval(poller)

      let lastInjectedKanji = null

      const observer = new MutationObserver(() => {
        const flashcard = reviewContainer.querySelector('.uiFcCard')
        if (!flashcard || !isCardFlipped(flashcard)) return

        const kanjiChars = getFlashcardKanjiChars(flashcard)
        if (!kanjiChars.length) return

        const currentKanji = kanjiChars.join('')

        // Skip if we already injected for this exact kanji
        if (currentKanji === lastInjectedKanji) return

        lastInjectedKanji = currentKanji
        removeExistingStrokeSection()
        injectStrokeOrderSection(kanjiChars, flashcard)
      })

      // Watch for class changes (flip) and DOM changes (new card) in one observer
      observer.observe(reviewContainer, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        subtree: true
      })
    }, POLL_INTERVAL_MS)
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

    if (isReviewPage()) {
      initReviewPage()
    } else if (isStudyPage()) {
      initStudyPage()
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()