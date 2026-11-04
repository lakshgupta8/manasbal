# @manasbal/icons

Manasbal's own icons, as SVG files in [`svg/`](svg). A later step turns them into React components.

## Drawing rules

Every icon follows these rules. `src/svg.test.ts` checks each file in `svg/` against them, so a file that breaks one fails `pnpm test`.

| Rule   | What it means                                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Size   | A 24 × 24 frame (`viewBox="0 0 24 24"`) with 2 px left empty all round, so the drawing fits in 20 × 20.                                                             |
| Line   | A 2 px stroke with round ends and round corners (`stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`), set once on the `<svg>`.                 |
| Colour | The stroke is `currentColor` and there is no fill (`fill="none"`), so an icon takes the colour of the text around it. Shapes carry no colour or style of their own. |
| Shapes | Only `path`, `circle`, `line`, `polyline`, `polygon`, `rect` and `ellipse`.                                                                                         |
| Name   | `kebab-case.svg`, for example `shopping-bag.svg`.                                                                                                                   |
| Origin | Drawn for Manasbal from scratch. Never trace or copy an icon from any other set, and draw nothing that imitates a brand mark.                                       |

Check a new icon at 16, 20 and 24 px: if it turns into a blob when small, draw it simpler.

## Icons

`cart`, `close`, `filter`, `heart`, `menu`, `plus`, `search`, `shopping-bag`, `sort`, `star`, `star-half` (the left half of `star`, for half ratings), `user`.

```bash
pnpm --filter @manasbal/icons test   # checks every file against the rules
```
