import type { Meta, StoryObj } from "@storybook/react-vite";
import { ColourScales, MeaningLayer, RadiusScale, SpacingScale, TypeScale } from "./TokenPreview";

// The design tokens, read from the same JSON files theme.css is built from.
const meta = {
  title: "Foundations/Tokens",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Colours: Story = {
  render: () => (
    <>
      <ColourScales />
      <MeaningLayer />
    </>
  ),
};

export const Spacing: Story = { render: () => <SpacingScale /> };

export const Type: Story = { render: () => <TypeScale /> };

export const Radius: Story = { render: () => <RadiusScale /> };
