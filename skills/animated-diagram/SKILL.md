---
name: animated-diagram
description: Turns a system-design topic into an animated diagram — a seamless looping GIF (plus an MP4 and a still PNG) in which the arrows march and every icon has its own idle animation, drawn in a theme set once per project. Use when the user asks for an animated diagram, a system design GIF, a diagram post (LinkedIn, X, Instagram, Threads), or to explain X as a diagram — a numbered flow, an A-vs-B comparison or a layered stack.
---

# Animated diagram

You write a small JSON description (nodes in grid cells, numbered steps, groups); the renderer lays it out, checks
the layout, and renders 90 frames into `<name>.gif`, `<name>.mp4`, `<name>.png` and `<name>.check.json`. You never
write coordinates.

`$SKILL` below is the folder holding this file (`${CLAUDE_SKILL_DIR}` in Claude Code). Needs Node ≥ 22, Google
Chrome and ffmpeg. Once per machine: `npm install --prefix "$SKILL"`. If `ANIMATED_DIAGRAM_RENDER_LOCK` is set,
every render waits for that lock directory, so only one Chrome renders at a time.

## Workflow

### 1. Theme first

Look for `diagram-theme.json` next to where the diagram will live (`render` checks there, then the working folder).
If there is none, set one up before anything else. Ask which the user wants:

```sh
node "$SKILL/scripts/cli.mjs" theme --preset machine-room-dark          # or light, dark
node "$SKILL/scripts/cli.mjs" theme --brand "#E4572E,#17BEBB" --mode light
node "$SKILL/scripts/cli.mjs" theme --from-image logo.png --mode dark
node "$SKILL/scripts/cli.mjs" theme --check my-theme.json               # vet a hand-edited theme
```

Each writes `diagram-theme.json` (`--out` to change it) and prints the colours with their contrast ratios. A theme
that fails contrast (4.5:1 for every text colour on its ground) or the dark rule is refused, with the nearest
passing colour proposed. Details: `reference/theme-setup.md`.

### 2. Content

From the user's topic or source text, draft the nodes and the numbered steps, and show the step list in chat:

```
1. User → DNS: DNS lookup
2. DNS → User: nearest edge IP (reply)
3. User → Edge server: GET /logo.png
```

Wait for the user to confirm it. Every arrow is a claim: check each against a source before you render.

### 3. The JSON

Choose the template with `reference/templates.md` (flow-grid, comparison or stack) and write `<topic>.json` per
`reference/diagram-format.md`. Start from the closest example: `examples/cdn.json` (flow-grid),
`examples/cache-strategies.json` (comparison) or `examples/web-stack.json` (stack). Place nodes by cell only;
`offset` is a last-resort nudge of a few px.

### 4. Icons

```sh
node "$SKILL/scripts/cli.mjs" icons          # the library: user, laptop, phone, rack, tower, database, cache, …
```

If a node needs an icon the library lacks, draw it following `reference/icon-rulebook.md` into
`./diagram-icons/<name>.js` next to the diagram, then review it at 2× beside two existing icons before use:

```sh
node "$SKILL/scripts/cli.mjs" icon-sheet <name> laptop rack --out sheet.png
```

### 5. Render

```sh
node "$SKILL/scripts/cli.mjs" render <topic>.json --out out/      # --theme <preset|file>, --style filled|line|duotone
```

Exit codes: `0` ok · `2` the check failed (the still and `<topic>.check.json` are written, no GIF) · `3` no theme yet ·
`1` bad input (the diagram's or theme's errors are printed with their JSON paths).

On exit 2, read `out/<topic>.check.json`. Each failure has a `code`, the `ids` involved (node ids, step arrows as
`s<index>`) and a `detail`. Fix the JSON (move a cell, shorten a label, split a step, use fewer rows) and render
again — at most 3 rounds. The fixes per code are in `reference/templates.md`. Then open the PNG and look at it
yourself: the check catches collisions, not awkward reading order.

### 6. Report

Give the user the paths of the GIF, MP4 and PNG, the GIF's size (budget about 1 MB at 1080×1350) and the check
summary, including any warnings.
