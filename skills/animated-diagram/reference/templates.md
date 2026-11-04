# Templates, layout and the check

## Which template

- **flow-grid** — one panel, nodes on a grid, numbered steps between them, optional groups and HIT/MISS branches.
  The default for "how X works". Best at 2 columns × 3 rows (`examples/cdn.json`); 3 columns fit short names.
- **comparison** — two panels side by side under one headline, "A vs B", with each name in its side colour
  (`examples/cache-strategies.json`).
  Each panel is only ~490 px wide: use **1 column** and 3–5 rows, and text boxes (`"type": "text"`) for roles like
  "Prompt Builder". A tray needs a row of its own.
- **stack** — horizontal layers top to bottom (client → edge → service → data), each row a labelled band, its nodes
  spread evenly (`examples/web-stack.json`). Up to 4 layers with sub-labels, 5 without. Steps may only join
  adjacent layers.
- **map** — a whole system on one page: up to 6 colour zones, 12 to 25 small nodes, arrows routed round them
  (`examples/anatomy-of-an-ai-app.json`). Each numbered step gets a badge on its arrow and its words in a legend rail,
  so steps have no text beside the line. Use the `poster` canvas (1280×800, up to 7 columns × 5 rows, legend at the
  right) or `linkedin-portrait` (up to 4 columns × 6 rows, legend below). Keep names to about 16 characters.

## Laying out a map

Placement does the work. A map routes anything, but a tidy one comes from where the nodes sit:

- Put the node most arrows touch in the middle, with what it talks to next to it. Most steps should join neighbours.
- A zone is the rectangle of its members' cells, so plan zones as blocks. Nothing else may sit inside one, and an empty
  cell inside a zone is a good way for an arrow to pass through.
- Make the main path read as one line of travel, usually a U, so the eye can follow the numbers.
- Instead of an arrow to every member of a zone, give the zone an `id` and end one arrow at `zone:<id>`.
- Steps without a number and with `""` as their label are side routes: they get no badge and no legend row.

## How steps are drawn (the routing envelope)

This section is for flow-grid, comparison and stack. A map routes freely: see `ARROW_TANGLE` below.

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
| `UNROUTABLE` | a step can't be drawn inside the envelope; on a map, the gutters round it are full | move a cell so the step joins neighbours or has a free corner; on a map, leave a cell empty on the way or end the arrow at a zone |
| `ARROW_TANGLE` | on a map: an arrow has over 4 bends or runs over 2.5× the distance it covers, or too many arrows cross | move the arrow's ends closer; put hubs beside what they talk to |
| `LEGEND_OVERFLOW` | on a map: the numbered steps don't fit the legend rail (about 17 one-line rows on a poster) | merge steps, or shorten labels so they stay on one line |
| `TEXT_OUT_OF_CANVAS`, `TEXT_OUT_OF_PANEL` | a text runs off the card or out of its panel | shorten the label or name; move the node inward |
| `TITLE_TOO_WIDE` | the headline is wider than the card (about 36 characters at 1080 wide) | shorten the title, or a comparison panel's title |
| `LABEL_OVERLAP` | two texts touch (a subtitle running into the brand counts) | shorten one, or move a node to give the label room |
| `LABEL_ON_ICON` | a text lies on a node | move the node (or drop its `offset`), shorten the label |
| `LABEL_ON_ARROW` | a text crosses another step's arrow | move the node so the arrows separate, or shorten the label |
| `ARROW_THROUGH_NODE` | an arrow passes through a node | rearrange cells so the step's path is clear |
| `ARROW_OVERLAP` | two arrows run on one line | move a cell so each step has its own path |
| `ROWS_TOO_TALL` | the rows need more height than the panel has | use fewer rows, or drop sub-labels |
| `EMPTY_BAND` | a stretch of the panel taller than a row is empty | use fewer rows, or fill the empty ones |
| `TEXT_TOO_SMALL` | text under 13 px | (only a custom theme or icon can cause it) |
| `SEAM` | the loop jumps from the last frame to the first | an icon's loop isn't seamless: fix its `loop()` |
| `FLICKER` | still pixels shimmer across the loop | something outside the icons and arrows animates |
| `FILL_DRIFT` | a zone or panel came out in the wrong colour: the GIF's palette ran out of room and merged it | fewer zones, or fewer moving parts in that colour |
| `FRAME_COUNT`, `DELAY`, `LOOP` | the GIF's timing is wrong | (renderer bug: report it) |
| `FILE_SIZE` | the GIF is over the canvas's platform cap | fewer moving parts, or a smaller canvas |
| `BUDGET` | a warning, not a failure: the GIF is over its size budget but under the cap | fine to post; fewer moving parts if it loads slowly |

Labels shorter than about 24 characters fit beside any arrow on one or two lines. Node names up to about 28
characters fit a 2-column grid on one line, about 18 in 3 columns; longer ones wrap to two lines.
