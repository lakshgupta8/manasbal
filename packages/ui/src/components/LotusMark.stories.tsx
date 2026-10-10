import type { Meta, StoryObj } from "@storybook/react-vite";
import { LotusMark } from "./LotusMark";

const meta = {
  title: "Brand/LotusMark",
  component: LotusMark,
  args: { size: 64 },
} satisfies Meta<typeof LotusMark>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Next to a visible "Manasbal" wordmark the mark is decoration, so screen readers skip it. */
export const Decorative: Story = {};

/** On its own the mark needs a name. */
export const Labelled: Story = {
  args: { title: "Manasbal" },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", alignItems: "end", gap: 16 }}>
      {[16, 24, 32, 64].map((size) => (
        <LotusMark key={size} {...args} size={size} />
      ))}
    </div>
  ),
};
