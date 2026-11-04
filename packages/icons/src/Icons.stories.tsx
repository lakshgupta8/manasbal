import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconGallery } from "./gallery/IconGallery";

// Every icon from the generated list, so a new drawing shows up here after `build:icons`.
const meta = {
  title: "Foundations/Icons",
  component: IconGallery,
  parameters: { layout: "fullscreen" },
  args: { size: 24 },
  argTypes: {
    size: { control: "inline-radio", options: [16, 20, 24] },
  },
} satisfies Meta<typeof IconGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllIcons: Story = {};

/** The smallest size: no icon may turn into a blob here. */
export const Small: Story = { args: { size: 16 } };

export const Filtered: Story = { args: { initialQuery: "bag" } };

export const NoMatch: Story = { args: { initialQuery: "umbrella" } };
