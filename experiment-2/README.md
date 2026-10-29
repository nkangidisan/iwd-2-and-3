# Experiment 2 – Live Profile Studio

**Aim:** Build a responsive web interface that dynamically updates text based on user input using JavaScript.

## How to run
Open `index.html` in a browser (or use the VS Code *Live Server* extension).

## Features → Procedure mapping
| Step | Where it is done |
|---|---|
| 1. Responsive page with HTML & CSS | `index.html`, `style.css` (CSS Grid, media queries at 900px / 520px) |
| 2. Input elements | Text, email, select, textarea, colour radios, range slider, buttons |
| 3. Capture user input | `input` / `change` event listeners in `script.js` |
| 4. Update headings, paragraphs, labels | Greeting `<h1>`, preview card, counters, completeness label, page title |
| 5. Validate input with instant feedback | `validators` object: inline ✓/⚠ messages, red/green borders, shake on invalid submit, toast |
| 6. Test on different screen sizes | Footer badge shows live viewport width (Mobile / Tablet / Desktop) |

## Extras
- Live text analytics: words, characters, sentences, reading time
- Keyword-based tone detector (positive / neutral / negative)
- Text tools: UPPERCASE, lowercase, Title Case, Sentence case, trim spaces
- Accent colour theming, dark mode, adjustable bio font size
- Saved profiles are built with `createElement` and stored in `localStorage`, with edit and delete

## Concepts used
DOM selection (`querySelector`), `textContent`, `classList`, CSS custom properties set from JS, event handling, regular expressions, `localStorage`.
