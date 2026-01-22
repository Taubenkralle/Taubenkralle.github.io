# Theme Guide

This repo uses a base Matrix look. Some subpages can switch themes via a
toggle button (homepage stays Matrix).

## Theme system
- CSS: `themes.css`
- JS: `themes.js`
- Body class: `theme-onepiece`, `theme-matrix`, etc.
- Stored in `localStorage` key `site-theme`.

## Add a new theme
1. Define variables on `body.theme-<name>` in the page stylesheet.
2. Add any theme-specific overrides scoped to `.theme-<name>`.
3. Ensure `themes.js` includes the theme in the list.

## Variables used
- `--heading`, `--link`, `--link-hover`, `--link-shadow`
- `--toggle-bg`, `--toggle-border`, `--toggle-text`, `--toggle-shadow`
- `--rain-opacity`, `--rain-filter`
