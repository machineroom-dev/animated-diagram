# Theme setup

A theme is `diagram-theme.json`: colour tokens plus type, shape and brand. Icons and layout read only tokens, so
changing the theme never means editing an icon. `render` uses the `diagram-theme.json` next to the diagram unless
`--theme <preset|file>` says otherwise.

## Making one

```sh
node "$SKILL/scripts/cli.mjs" theme --preset light|dark|machine-room-dark [--out diagram-theme.json] [--name <name>]
node "$SKILL/scripts/cli.mjs" theme --brand "#PRIMARY[,#ACCENT]" --mode light|dark
node "$SKILL/scripts/cli.mjs" theme --from-image logo.png --mode light|dark      # the two most common strong colours in it
node "$SKILL/scripts/cli.mjs" theme --check my-theme.json                         # vet a hand-edited file
```

`--brand` and `--from-image` start from the light or dark preset, recolour the brand roles (primary, accent,
headline, side A, group titles) and pull every text colour to the nearest shade that passes contrast.

## The rules every theme must pass

- **Contrast:** every text colour on each ground it is drawn on reaches 4.5:1 (WCAG 2.x) — ink on panel, bg and
  the tints; muted, hit and miss text on the panel and side tints; badge, headline, pill, group and brand text on
  their fills. A failure reads `CONTRAST [ink, panel]: … nearest passing ink: #…`.
- **Dark rule:** when the background is dark (relative luminance < 0.2), the icon outline must be light (> 0.5) and
  the paper fill dark (< 0.3), or icons lose their edges.

`theme` refuses a failing theme, and so does `render`.

## The file

| field | |
|---|---|
| `name`, `mode` | `mode` is `light` or `dark` |
| `style` | icon style: `filled` (default), `line` or `duotone`; `render --style` overrides it per run |
| `radius`, `lineWeight` | corner radius and arrow weight (2.6) at 1080 wide |
| `font` | `{ "family", "file" }`; the bundled Inter is `fonts/InterVariable.woff2`. In v1 a custom font file must sit in the skill's `fonts/` folder |
| `brand` | `{ "footer": "text", "logo": "logo.png" }`; the logo path is relative to the theme file and sits 28 px high left of the footer |
| `colors` | the 31 tokens below, each `#RRGGBB` |

Tokens: `bg panel panelStroke ink muted line outline paper neutral dark primary primaryDark tint amber hit hitText
miss missText badge badgeText accent brand head headText groupText sideA sideAText sideATint sideB sideBText
sideBTint`. The `side*` tokens colour the two panels of a comparison.
