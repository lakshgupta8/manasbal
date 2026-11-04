# @manasbal/icons

Manasbal's own icons: SVG drawings in [`svg/`](svg), and a React component for each, built from them.

```tsx
import { ShoppingBagIcon } from "@manasbal/icons";

<ShoppingBagIcon />                      // decorative: aria-hidden, 24 px
<ShoppingBagIcon size={16} title="Bag" /> // role="img", named "Bag"
```

Every icon is on the **Foundations/Icons** page in Storybook (`pnpm --filter @manasbal/ui dev`), where you can filter by name and pick a size. `iconList` lists every icon by name, for a gallery or a picker.

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

| Icon            | Drawing                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `alert`         | A lotus bud with an exclamation mark                                                                 |
| `arrow-left`    | A shaft with an open head pointing left                                                              |
| `arrow-right`   | A shaft with an open head pointing right                                                             |
| `bank`          | A building under a curved, petal-like roof, four columns and a base line; no bank's mark             |
| `bell`          | A bell with a pointed, lotus-bud body, a rim and a small clapper below                               |
| `card`          | A rounded card with a band across it and a ripple where the numbers would be; no card network's mark |
| `cart`          | A soft-cornered basket on a handle, a ripple inside, two round wheels                                |
| `check`         | A check whose long stroke curves up like a reed                                                      |
| `chevron-down`  | An open angle pointing down                                                                          |
| `chevron-left`  | An open angle pointing left                                                                          |
| `chevron-right` | An open angle pointing right                                                                         |
| `chevron-up`    | An open angle pointing up                                                                            |
| `clock`         | A round face with a single petal-shaped hand and four short hour ticks                               |
| `close`         | Two crossing strokes                                                                                 |
| `edit`          | A petal-shaped nib with its slit, writing a ripple                                                   |
| `eye`           | An almond of two curves meeting at pointed corners, and a round pupil                                |
| `eye-off`       | A closed eyelid: one lower curve with three lashes                                                   |
| `filter`        | A funnel with a ripple for its rim and curved sides                                                  |
| `heart`         | Two pointed petals leaning out, meeting at the bottom                                                |
| `info`          | A lily pad (a circle with a small notch) with an i                                                   |
| `lock`          | A shackle over a body with a rounded, bud-like bottom and a short keyhole line                       |
| `logout`        | An arched doorway open on the right, with an arrow leaving through it                                |
| `map-pin`       | A rounded marker coming to a point, with a small ripple inside, standing on a ripple                 |
| `menu`          | Three ripples                                                                                        |
| `minus`         | One stroke                                                                                           |
| `moon`          | A crescent above a ripple, like the moon over the lake                                               |
| `package`       | A box with a lid and a V-shaped tape label                                                           |
| `plus`          | Two crossing strokes                                                                                 |
| `return`        | An arrow pointing back, curving down and round into a ripple                                         |
| `search`        | A lens and handle                                                                                    |
| `shopping-bag`  | A bag with rounded bottom corners, a handle and a ripple inside                                      |
| `sort`          | Three ripples getting shorter, beside a down arrow                                                   |
| `star`          | Five pointed petals                                                                                  |
| `star-half`     | `star` split down the middle, for half ratings                                                       |
| `store`         | A shopfront: an awning with a rippled edge, a front wall and a door                                  |
| `sun`           | A half sun rising over a ripple, with five short rays                                                |
| `trash`         | An open bin with rounded bottom corners and two slats, a petal falling in                            |
| `truck`         | A cargo box and a cab with a curved front on two round wheels                                        |
| `user`          | A head and shoulders standing on a ripple                                                            |
| `wallet`        | A wallet with a curved flap and a rounded clasp on its side                                          |

## Adding or changing an icon

1. Draw it by the rules above and save it as `svg/<name>.svg`.
2. Run `pnpm --filter @manasbal/icons build:icons`. It tidies each drawing with SVGO (only comments, metadata and ids are removed, so the paths stay exactly as drawn), turns it into `src/generated/<Name>Icon.tsx` with SVGR, and rewrites `src/index.ts`. Never edit those files by hand.
3. Run `pnpm --filter @manasbal/icons test`: it checks every drawing against the rules, that each component draws exactly its drawing, and that the committed files match a fresh build.
