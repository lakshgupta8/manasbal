import type { Meta, StoryObj } from "@storybook/react-vite";
import { CategoryTiles } from "./CategoryTiles";

const categories = [
  "Books & Stationery",
  "Clothing",
  "Electronics accessories",
  "Footwear",
  "Home & Kitchen",
  "Toys & Games",
].map((name) => ({ name, href: `#${name.toLowerCase().replaceAll(/[^a-z]+/g, "-")}` }));

/**
 * Categories as tiles: each tile is one link with the name (body medium, text.default) and a
 * 20 px chevron (text.muted). At least 64 px tall, padding 16, radius 16, 1 px border.default on
 * surface.page; tiles at least 220 px wide, 16 px apart, as many columns as fit. No hover state,
 * like the product cards; a 2 px focus.ring 2 px away.
 */
const meta = {
  title: "Navigation/CategoryTiles",
  component: CategoryTiles,
  args: { categories },
  decorators: [
    (Story) => (
      <div style={{ padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CategoryTiles>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Phone: Story = { tags: ["mobile"] };

export const Dark: Story = { parameters: { theme: "dark" } };
