# Icon rulebook

How to draw a new icon so it belongs to the set. Read this before drawing one; check the result with the review sheet
before using it.

## The file

One ES module per icon, `engine/icons/<name>.js` (bundled) or `./diagram-icons/<name>.js` (a project's own icons,
which win over bundled ones of the same name):

```js
import { setA, clamp, ease, easeBack, kf, bump, R } from '../icon-kit.js';   // local icons: '/engine/icon-kit.js'

export default {
  name: 'queue',            // the name diagrams use; lower-case, dash-separated
  box: [110, 70],           // [w, h] at scale 1, centred on (0,0): everything the icon draws, at every frame
  draw: (id, T) => `<g id="${id}">…</g>`,  // SVG string; T is theme.colors
  loop: (id, f, T) => { … },               // sets frame f of the idle loop
};
```

A bundled icon is also added to `engine/icons/index.js`.

## Drawing

- **Frame:** a local frame about 100 px across, centred on (0,0). It is drawn at 1.15× in a diagram (0.42× in a tray),
  so details thinner than about 1.6 px vanish.
- **Weight:** outlines are 3 px in `T.outline`; inner details are 1.8–2.6 px. Round or miter joins, nothing hairline.
- **View:** flat, front-facing. Cylinders (databases, caches) are the one exception: an ellipse top and a curved base.
  No perspective, no isometric, no drop shadows, no gradients.
- **Colour:** theme tokens only (`T.paper`, `T.tint`, `T.primary`, `T.primaryDark`, `T.neutral`, `T.dark`, `T.amber`,
  `T.hit`, `T.miss`, `T.accent`, `T.outline`). Never a hex value, a named colour or `rgb()`. On a dark theme the
  outline is light and the fills are dark; the theme handles that, the icon never does.
- **Roles:** every `path`, `rect`, `circle`, `ellipse`, `line`, `polyline` and `polygon` carries both role attributes,
  written with `R(fill, stroke)`:
  - fill: `fill` (light body: `tint`, `neutral`), `fill2` (strong body: `primary`, `primaryDark`), `paper`, `accent`
    (small signal colours and solid ink parts: `amber`, `hit`, `miss`, `outline` used as a fill), `none`;
  - stroke: `outline` (the 3 px silhouette), `detail` (inner lines), `accent` (a coloured line that keeps its colour in
    every style, such as a stopwatch hand or a lit band), `none`.

  The styles restyle by role: **line** knocks `fill`/`fill2`/`paper` back to the panel and thins strokes; **duotone**
  drops the outline, makes `fill`/`paper` tint and `fill2`/`accent` primary, and colours details primary. Pick roles
  so the icon still reads in all three. A part that must stay visible in line style needs a stroke or an `accent`
  fill. A part that sits on a `fill2` body in duotone should not itself be `fill2`/`accent`.
- **Ids:** every id is prefixed with the `id` argument (`${id}-fan`) so two copies never clash. Clip paths too.
- **Text inside an icon:** short (≤ 4 characters, like `DNS`, `API`), weight 700–800, from a token.

## The idle loop

- 90 frames at 30 ms. `loop(id, 90)` must look exactly like `loop(id, 0)`. Rotations go a whole symmetry step per
  loop (a 3-blade fan 120° or 240°), cycles divide 90 (30, 45, 22.5 frames), keyframes return to their start.
- Deterministic: a pure function of `f`. No `Date`, no `Math.random`, no state kept between calls.
- Animate layers, not styles: change `transform`, `opacity` or geometry (`d`, `width`, `x`…), never `fill`, `stroke`
  or `stroke-width`. For a light that turns on, draw the lit part over the unlit one and toggle its opacity.
- Readable at feed size: at least 4 px of travel or a clear state change, at most 20 px.
- No whole-icon flash, nothing blinking faster than 3 times a second, and nothing ever leaves `box`.
- Two copies of an icon move in unison (the loop depends on `f` only), so a diagram never needs to offset them.

## Review (before first use)

```sh
node "$SKILL/scripts/cli.mjs" icon-sheet <new-icon> laptop rack --out sheet.png
```

Look at the sheet zoomed to 2×: the new icon beside two existing ones, at f0, f30 and f60 in filled, line and duotone.
It must match their weight, palette and perspective, and its motion must be visible. Then run the contract tests
(`npm test`): seamless, moves, stays inside `box`, tokens only, roles present, loops leave style attributes alone.

## Clean room

Draw from the description of the thing, never from someone else's artwork. Do not open, trace, measure or copy any
other publisher's diagram or icon set, and keep the motion your own.
