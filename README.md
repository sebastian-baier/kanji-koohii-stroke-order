# koohii-stroke-order

A Tampermonkey userscript that adds stroke order diagrams to [Kanji Koohii](https://kanji.koohii.com/), powered by the [KanjiVG](https://kanjivg.tagaini.net/) dataset.

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

## Preview

Stroke order diagrams appear directly below the study frame on every kanji detail page. Each stroke is drawn in a distinct color so you can follow the sequence at a glance.

## Requirements

- A browser with [Tampermonkey](https://www.tampermonkey.net/) installed (Chrome, Firefox, Edge, Safari)
- A [Kanji Koohii](https://kanji.koohii.com/) account

## Installation

1. Install the [Tampermonkey extension](https://www.tampermonkey.net/) for your browser
2. Download [`kanji_koohii_stroke_order.user.js`](./kanji_koohii_stroke_order.user.js)
3. Drag and drop the file onto your browser — Tampermonkey will detect it and show an install prompt
4. Click **Install**

## Usage

Navigate to any kanji study page on Kanji Koohii, for example:

```
https://kanji.koohii.com/study/kanji/8
```

The stroke order diagram will appear automatically below the study frame.

## How it works

- On page load the script waits for Vue to finish rendering the kanji element
- It reads the kanji character from `.kanji .cj-k`
- It fetches the matching SVG from the KanjiVG GitHub repository
- It colorizes each stroke path and injects the diagram after `.rtkframe`

SVG data is fetched live from:
```
https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/<unicode>.svg
```

## Data source

Stroke order data is provided by [KanjiVG](https://kanjivg.tagaini.net/) by Ulrich Apel, licensed under [Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

## License

MIT
