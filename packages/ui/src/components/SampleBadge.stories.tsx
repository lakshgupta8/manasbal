import type { Meta, StoryObj } from "@storybook/react-vite";
import { SampleBadge } from "./SampleBadge";

const meta = {
  title: "Layout/SampleBadge",
  component: SampleBadge,
} satisfies Meta<typeof SampleBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InsideReview: Story = {
  render: (args) => (
    <p>
      <SampleBadge {...args} /> This review was written for the demo store.
    </p>
  ),
};
