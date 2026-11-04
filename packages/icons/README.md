# @manasbal/icons

Manasbal's own icons: SVG drawings in [`svg/`](svg), and a React component for each, built from them.

```tsx
import { ShoppingBagIcon } from "@manasbal/icons";

<ShoppingBagIcon />                      // decorative: aria-hidden, 24 px
<ShoppingBagIcon size={16} title="Bag" /> // role="img", named "Bag"
```

`size` is 16, 20 or 24 (default 24). Without a `title` an icon is decorative and hidden from screen readers; give it one when the icon carries meaning on its own, such as an icon-only button. Other props go to the `<svg>`.

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

| Icon           | Drawing                                                                   |
| -------------- | ------------------------------------------------------------------------- |
| `alert`        | A lotus bud with an exclamation mark                                      |
| `cart`         | A soft-cornered basket on a handle, a ripple inside, two round wheels     |
| `check`        | A check whose long stroke curves up like a reed                           |
| `close`        | Two crossing strokes                                                      |
| `edit`         | A petal-shaped nib with its slit, writing a ripple                        |
| `filter`       | A funnel with a ripple for its rim and curved sides                       |
| `heart`        | Two pointed petals leaning out, meeting at the bottom                     |
| `info`         | A lily pad (a circle with a small notch) with an i                        |
| `menu`         | Three ripples                                                             |
| `minus`        | One stroke                                                                |
| `plus`         | Two crossing strokes                                                      |
| `search`       | A lens and handle                                                         |
| `shopping-bag` | A bag with rounded bottom corners, a handle and a ripple inside           |
| `sort`         | Three ripples getting shorter, beside a down arrow                        |
| `star`         | Five pointed petals                                                       |
| `star-half`    | `star` split down the middle, for half ratings                            |
| `trash`        | An open bin with rounded bottom corners and two slats, a petal falling in |
| `user`         | A head and shoulders standing on a ripple                                 |

## Adding or changing an icon

1. Draw it by the rules above and save it as `svg/<name>.svg`.
2. Run `pnpm --filter @manasbal/icons build:icons`. It tidies each drawing with SVGO (only comments, metadata and ids are removed, so the paths stay exactly as drawn), turns it into `src/generated/<Name>Icon.tsx` with SVGR, and rewrites `src/index.ts`. Never edit those files by hand.
3. Run `pnpm --filter @manasbal/icons test`: it checks every drawing against the rules, that each component draws exactly its drawing, and that the committed files match a fresh build.
