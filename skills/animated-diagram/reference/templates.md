# Templates, layout and the check

## Which template

- **flow-grid** — one panel, nodes on a grid, numbered steps between them, optional groups and HIT/MISS branches.
  The default for "how X works". Best at 2 columns × 3 rows (`examples/cdn.json`); 3 columns fit short names.
- **comparison** — two panels side by side under "A vs B" pills, each in its side colour (`examples/cache-strategies.json`).
  Each panel is only ~490 px wide: use **1 column** and 3–5 rows, and text boxes (`"type": "text"`) for roles like
  "Prompt Builder". A tray needs a row of its own.
- **stack** — horizontal layers top to bottom (client → edge → service → data), each row a labelled band, its nodes
  spread evenly (`examples/web-stack.json`). Up to 4 layers with sub-labels, 5 without. Steps may only join
  adjacent layers.

## How steps are drawn (the routing envelope)

- **Neighbours** (in one row or one column with nothing between them, so a step may skip an empty cell) get a
  straight arrow; a request and its reply, a parallel pair.
- **Other steps** get one bend (an L, whichever corner is free). In a stack the arrow leaves the node's side and
  drops into the next layer. A request and its reply that can't run straight get two parallel Ls, nested so they
  never cross; both lines need room.
- **Retries and back edges** (`kind: "retry"`, or a step back to a node met earlier) go round the nearest clear
  gutter — the margin of the panel or the line between columns — with two bends.
- Anything else is refused with `UNROUTABLE`, naming the step and the node in the way. Rearrange the cells so the
  step joins neighbours or has a clear corner; there is no free-form routing.

## The check

`render` runs it on every diagram. A failure lists `code`, `ids` and `detail`:

| code | means | change |
|---|---|---|
| `UNROUTABLE` | a step can't be drawn inside the envelope | move a cell so the step joins neighbours or has a free corner |
| `TEXT_OUT_OF_CANVAS`, `TEXT_OUT_OF_PANEL` | a text runs off the card or out of its panel | shorten the label or name; move the node inward |
| `TEXT_OUT_OF_PILL` | the headline (or a comparison panel's title) is wider than its pill | shorten the title |
| `LABEL_OVERLAP` | two texts touch | shorten one, or move a node to give the label room |
| `LABEL_ON_ICON` | a text lies on a node | move the node (or drop its `offset`), shorten the label |
| `LABEL_ON_ARROW` | a text crosses another step's arrow | move the node so the arrows separate, or shorten the label |
| `ARROW_THROUGH_NODE` | an arrow passes through a node | rearrange cells so the step's path is clear |
| `ARROW_OVERLAP` | two arrows run on one line | move a cell so each step has its own path |
| `EMPTY_BAND` | a stretch of the panel taller than a row is empty | use fewer rows, or fill the empty ones |
| `TEXT_TOO_SMALL` | text under 13 px | (only a custom theme or icon can cause it) |
| `SEAM` | the loop jumps from the last frame to the first | an icon's loop isn't seamless: fix its `loop()` |
| `FLICKER` | still pixels shimmer across the loop | something outside the icons and arrows animates |
| `FRAME_COUNT`, `DELAY`, `LOOP` | the GIF's timing is wrong | (renderer bug: report it) |
| `FILE_SIZE` | the GIF is over the canvas's platform cap | fewer moving parts, or a smaller canvas |

Labels shorter than about 24 characters fit beside any arrow on one or two lines. Node names up to about 28
characters fit a 2-column grid on one line, about 18 in 3 columns; longer ones wrap to two lines.
