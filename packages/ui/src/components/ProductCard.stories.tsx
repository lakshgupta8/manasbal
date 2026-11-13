import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductCard, type ProductCardProps } from "./ProductCard";

// A made-up picture drawn here (two soft bands), so the story needs no image file.
const PICTURE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="400"><rect width="480" height="400" fill="#C8E0E2"/><rect y="250" width="480" height="150" fill="#F6C5D2"/></svg>',
)}`;

/**
 * One product: picture (or a grey box), name as the one link, rating and price. The whole card
 * is clickable through the name link; the focus ring goes round the card. Nothing that pushes
 * people: no stock counts, countdowns or discounts. No hover state is drawn in Figma, so none is
 * drawn here.
 *
 * Draws on surface.page in both themes; brand.primary on surface.card in dark is about 2.4:1,
 * below the 3:1 icon rule, so the card must not use surface.card.
 */
const meta = {
  title: "Product/ProductCard",
  component: ProductCard,
  args: {
    name: "Striped cotton tee",
    href: "#striped-cotton-tee",
    pricePaise: 49900,
    rating: 4.5,
    reviews: "(120 reviews)",
    sample: true,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 270, padding: 8 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProductCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutRating: Story = { args: { rating: undefined, reviews: undefined } };

export const NotSample: Story = { name: "Not sample data", args: { sample: false } };

export const LongName: Story = {
  name: "Long name",
  args: { name: "Handloom cotton kurta with mirror work on the yoke and long sleeves" },
};

export const WithPicture: Story = {
  args: { image: { src: PICTURE, alt: "A pale teal and pink cotton tee, folded" } },
};

export const Focus: Story = { args: { "data-preview": "focus" } as Partial<ProductCardProps> };

export const Dark: Story = { parameters: { theme: "dark" } };

export const FocusDark: Story = {
  name: "Focus, dark",
  parameters: { theme: "dark" },
  args: { "data-preview": "focus" } as Partial<ProductCardProps>,
};
