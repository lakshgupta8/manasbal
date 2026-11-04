# @manasbal/icons

Manasbal's own icons, as SVG files in [`svg/`](svg). A later step turns them into React components.

## Drawing rules

Every icon follows these rules. `src/svg.test.ts` checks each file in `svg/` against all of them except the 2 px empty border, Style and Origin, which a reviewer checks by eye; a file that breaks a checked rule fails `pnpm test`.

| Rule   | What it means                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Size   | A 24 × 24 frame (`viewBox="0 0 24 24"`) with 2 px left empty all round, so the drawing fits in 20 × 20.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Line   | A 2 px stroke with round ends and round corners (`stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`), set once on the `<svg>`.                                                                                                                                                                                                                                                                                                                                                                               |
| Colour | The stroke is `currentColor` and there is no fill (`fill="none"`), so an icon takes the colour of the text around it. Shapes carry no colour or style of their own.                                                                                                                                                                                                                                                                                                                                                               |
| Style  | The lake theme of the lotus mark (`packages/ui/src/components/LotusMark.tsx`). Where a shape has a point or a lobe, draw it as a pointed petal: two curves meeting at a tip, not a sharp polygon corner (`star`, `heart`). Add a ripple, a short wave drawn as `Q … T` like the mark's water lines, where it fits: inside a bag or basket, as a base line, as the lines of a list (`menu`, `sort`), as the rim of the `filter` funnel. One accent per icon is enough; plain utility icons (`plus`, `close`, `search`) stay plain. |
| Shapes | Only `path`, `circle`, `line`, `polyline`, `polygon`, `rect` and `ellipse`.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Name   | `kebab-case.svg`, for example `shopping-bag.svg`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Origin | Drawn for Manasbal from scratch. Never trace or copy an icon from any other set, and draw nothing that imitates a brand mark.                                                                                                                                                                                                                                                                                                                                                                                                     |

Check a new icon at 16, 20 and 24 px: if it turns into a blob when small, draw it simpler.

## Icons

| Icon           | Drawing                                                               |
| -------------- | --------------------------------------------------------------------- |
| `cart`         | A soft-cornered basket on a handle, a ripple inside, two round wheels |
| `close`        | Two crossing strokes                                                  |
| `filter`       | A funnel with a ripple for its rim and curved sides                   |
| `heart`        | Two pointed petals leaning out, meeting at the bottom                 |
| `menu`         | Three ripples                                                         |
| `plus`         | Two crossing strokes                                                  |
| `search`       | A lens and handle                                                     |
| `shopping-bag` | A bag with rounded bottom corners, a handle and a ripple inside       |
| `sort`         | Three ripples getting shorter, beside a down arrow                    |
| `star`         | Five pointed petals                                                   |
| `star-half`    | `star` split down the middle, for half ratings                        |
| `user`         | A head and shoulders standing on a ripple                             |

```bash
pnpm --filter @manasbal/icons test   # checks every file against the rules
```
