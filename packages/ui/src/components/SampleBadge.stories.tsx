import type { Meta, StoryObj } from "@storybook/react-vite";
import { SampleBadge } from "./SampleBadge";

/**
 * Marks sample data. `kind="review"` (the default) says "Sample review"; `kind="item"` says
 * "Sample", for product pictures and other product data. Pages pass `label` in their language.
 */
const meta = {
  title: "Layout/SampleBadge",
  component: SampleBadge,
} satisfies Meta<typeof SampleBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Item: Story = { name: "Item (Sample)", args: { kind: "item" } };

export const InsideReview: Story = {
  render: (args) => (
    <p>
      <SampleBadge {...args} /> This review was written for the demo store.
    </p>
  ),
};

export const Dark: Story = {
  parameters: { theme: "dark" },
  render: () => (
    <p style={{ display: "flex", gap: 8, margin: 0 }}>
      <SampleBadge />
      <SampleBadge kind="item" />
    </p>
  ),
};
