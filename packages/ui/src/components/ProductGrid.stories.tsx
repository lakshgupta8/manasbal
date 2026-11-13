import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductGrid, type ProductGridItem } from "./ProductGrid";

const NAMES = [
  "Striped cotton tee",
  "Handloom shawl in indigo",
  "Brass tea strainer",
  "Linen cushion cover",
  "Block-printed table runner",
  "Clay water bottle",
  "Bamboo pen stand",
  "Handloom cotton kurta with mirror work on the yoke",
] as const;

// Made-up products: some rated, some not; every one marked as sample data, as the demo's are.
const products: ProductGridItem[] = NAMES.map((name, i) => ({
  id: `product-${i + 1}`,
  name,
  href: `#product-${i + 1}`,
  pricePaise: [49900, 189900, 34900, 59900, 129900, 44900, 24900, 249900][i]!,
  rating: i % 3 === 2 ? undefined : [4.5, 3.5, 5, 4, 2.5, 3][i % 6],
  reviews: i % 3 === 2 ? undefined : `(${(i + 1) * 12} reviews)`,
  sample: true,
}));

/**
 * Product cards in a list laid out as a grid, 24 px apart: 1 column below 600 px, 2 from 600 px,
 * 4 from 1024 px. These breakpoints are a code choice: Figma only draws frames at 375, 768 and
 * 1280 px, which land in 1, 2 and 4 columns. The "Two, phone" and "Eight, tablet" stories show
 * the narrower layouts. An empty grid says "No products here yet" (not drawn in Figma).
 */
const meta = {
  title: "Product/ProductGrid",
  component: ProductGrid,
  args: { products: products.slice(0, 3) },
  decorators: [
    (Story) => (
      <div style={{ padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProductGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const One: Story = { args: { products: products.slice(0, 1) } };

export const Three: Story = {};

export const Eight: Story = { args: { products } };

export const EightTablet: Story = { name: "Eight, tablet", tags: ["tablet"], args: { products } };

export const TwoPhone: Story = {
  name: "Two, phone",
  tags: ["mobile"],
  args: { products: products.slice(0, 2) },
};

export const Empty: Story = { args: { products: [] } };

export const EightDark: Story = {
  name: "Eight, dark",
  parameters: { theme: "dark" },
  args: { products },
};

export const EmptyDark: Story = {
  name: "Empty, dark",
  parameters: { theme: "dark" },
  args: { products: [] },
};
