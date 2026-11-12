import type { Meta, StoryObj } from "@storybook/react-vite";
import { Rating } from "./Rating";

/**
 * Five 24 px stars for a value from 0 to 5 in halves, with the review count after it in words.
 * Any other value (negative, above 5, not a half step, NaN) throws a RangeError, so a bad average
 * is caught where it is made instead of being drawn wrongly; round to halves before passing it.
 *
 * Draws on surface.page; brand.primary on surface.card in dark is about 2.4:1, below the 3:1 icon
 * rule, so a future ProductCard must use surface.page (as in Figma) or this needs a new token.
 */
const meta = {
  title: "Product/Rating",
  component: Rating,
  args: { value: 3.5, reviews: "(120 reviews)" },
  argTypes: { value: { control: { type: "range", min: 0, max: 5, step: 0.5 } } },
} satisfies Meta<typeof Rating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoReviewCount: Story = {
  name: "Without the review count",
  args: { reviews: undefined },
};

export const OneReview: Story = { args: { value: 5, reviews: "(1 review)" } };

const values = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

/** Every half step from 0 to 5, with and without the review count. */
function Sheet() {
  return (
    <div style={{ display: "grid", gap: 12, padding: 8 }}>
      {values.map((value) => (
        <Rating key={value} value={value} reviews={value % 1 === 0 ? "(120 reviews)" : undefined} />
      ))}
    </div>
  );
}

export const AllValuesLight: Story = { name: "All values, light", render: () => <Sheet /> };

export const AllValuesDark: Story = {
  name: "All values, dark",
  parameters: { theme: "dark" },
  render: () => <Sheet />,
};
