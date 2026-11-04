# Diagram format (v1)

One JSON file per diagram. `render` validates it before anything is drawn; every error names its JSON path, e.g.
`panels[0].nodes[3].icon: unknown icon "kafka" — closest: queue, rack, api; to add one, see reference/icon-rulebook.md`.
Unknown fields are errors too, so a typo never passes silently.

```json
{
  "canvas": "linkedin-portrait",
  "template": "flow-grid",
  "title": "How a CDN serves a request",
  "subtitle": "optional — one line under the headline",
  "footer": "optional — overrides the theme's brand text",
  "still": 45,
  "panels": [
    {
      "grid": { "cols": 2, "rows": 3 },
      "nodes": [
        { "id": "user", "icon": "laptop", "name": "User", "sub": "browser", "cell": [0, 0] },
        { "id": "dns", "icon": "globe", "name": "DNS", "sub": "returns the nearest edge", "cell": [1, 0] }
      ],
      "groups": [{ "label": "EDGE PoP · CLOSE TO THE USER", "nodes": ["edge", "cache"] }],
      "steps": [
        { "n": 1, "from": "user", "to": "dns", "label": "DNS lookup" },
        { "n": 2, "from": "dns", "to": "user", "label": "nearest edge IP", "reply": true }
      ]
    }
  ]
}
```

## Top level

| field | | |
|---|---|---|
| `canvas` | optional | `linkedin-portrait` 1080×1350 (default), `square` 1080×1080, `landscape` 1200×675 |
| `template` | required | `flow-grid`, `comparison` or `stack` (see `templates.md`) |
| `title` | flow-grid, stack | the headline, big plain type at the top of the card; a comparison's headline is its two panel titles, "A vs B" |
| `subtitle` | optional | one muted line under the headline; keep it short, it shares its row with the brand |
| `footer` | optional | the brand text at the right of the subtitle's row; default `theme.brand.footer` |
| `still` | optional | the frame (0–89) saved as the PNG; default 45 |
| `panels` | required | flow-grid and stack: exactly 1; comparison: exactly 2, each with a `title` |

GIF size caps per canvas (checked 2026-10-24): `linkedin-portrait` 5 MB, `square` 5 MB, `landscape` 15 MB (X).
Over the cap is a `FILE_SIZE` failure; over the 1 MB budget (scaled by area) is a warning.

## Panel

- `title` — a comparison panel's name: part of the headline, and a small caption in the panel.
- `grid` — `{ "cols": 1–4, "rows": 1–6 }`. Columns share the panel's width equally; rows spread to fill its height.
- `nodes` — at least one. Each sits in its own `[col, row]` cell, counted from 0.
- `groups` — optional `{ "label", "nodes": [ids] }`: a box around the members with its title in the top-right
  corner (top-left if an arrow would cross it). In a stack, a group names its layer and must be one row.
- `steps` — the arrows, in reading order (may be empty).

## Node

| field | | |
|---|---|---|
| `id` | required | unique in its panel; steps and check failures use it |
| `type` | optional | `icon` (default), `text` (a rounded box holding the name) or `tray` (a titled box of small icons) |
| `icon` | icon nodes | a library icon (`cli.mjs icons`) or one in `./diagram-icons/` |
| `name` | required | the name under the icon / in the box / the tray's title; wraps to two lines when it must |
| `sub` | optional | a small grey line under an icon node's name |
| `items` | trays | 2–6 `{ "icon", "caption" }`, laid out in balanced rows of up to 3 |
| `cell` | required | `[col, row]` |
| `offset` | optional | `[dx, dy]` px nudge after placement — a last resort |

## Step

| field | | |
|---|---|---|
| `from`, `to` | required | node ids in the same panel |
| `label` | required | the text beside the arrow (`""` for none); wraps to two lines when it must |
| `n` | optional | the number in the badge; unique per panel. Unnumbered steps are side notes (grey label) |
| `kind` | optional | `normal`, `hit` (green), `miss` (red), `retry` (red, short dashes, routed round a gutter), `solid` (no march) |
| `reply` | optional | short dashes; a step whose `from`/`to` swap an earlier step's is drawn beside it as the reply line |

Arrows march in the direction of the step. A request and its reverse form a parallel pair, straight or bent: long
dashes out, short dashes back. On a straight pair the request's label sits on the left (vertical) or above
(horizontal), the reply's on the right or below; on a bent pair each label keeps to the outside of its own line.
