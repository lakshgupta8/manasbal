import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { VariantPicker, type VariantPickerOption } from "./VariantPicker";

const SIZES: VariantPickerOption[] = [
  { value: "S", label: "S", available: true },
  { value: "M", label: "M", available: true },
  { value: "L", label: "L", available: false },
  { value: "XL", label: "XL", available: true },
];

const meta = {
  title: "Forms/VariantPicker",
  component: VariantPicker,
  args: { legend: "Size", name: "size", options: SIZES, defaultValue: "M" },
} satisfies Meta<typeof VariantPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Colours: Story = {
  args: {
    legend: "Colour",
    name: "colour",
    defaultValue: "Blue",
    options: [
      { value: "Black", label: "Black", available: true },
      { value: "Blue", label: "Blue", available: true },
      { value: "Red", label: "Red", available: false },
    ],
  },
};

export const NoneChosen: Story = { name: "None chosen", args: { defaultValue: undefined } };

/** The caller keeps the choice and shows it, as the product page does. */
function ControlledPicker() {
  const [size, setSize] = useState("S");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <VariantPicker legend="Size" name="size" options={SIZES} value={size} onChange={setSize} />
      <output>Chosen: {size}</output>
    </div>
  );
}

export const Controlled: Story = { render: () => <ControlledPicker /> };

/** Long names wrap onto more rows at phone width. */
export const Mobile: Story = {
  tags: ["mobile"],
  args: {
    legend: "Colour",
    name: "colour",
    defaultValue: "Forest green",
    options: [
      { value: "Charcoal", label: "Charcoal", available: true },
      { value: "Forest green", label: "Forest green", available: true },
      { value: "Mustard yellow", label: "Mustard yellow", available: false },
      { value: "Off white", label: "Off white", available: true },
    ],
  },
};

const STATES: { name: string; option: VariantPickerOption; chosen?: boolean }[] = [
  { name: "default", option: { value: "default", label: "M", available: true } },
  { name: "hover", option: { value: "hover", label: "M", available: true, preview: "hover" } },
  { name: "focus", option: { value: "focus", label: "M", available: true, preview: "focus" } },
  { name: "chosen", option: { value: "chosen", label: "M", available: true }, chosen: true },
  {
    name: "chosen-focus",
    option: { value: "chosen-focus", label: "M", available: true, preview: "focus" },
    chosen: true,
  },
  { name: "unavailable", option: { value: "unavailable", label: "L", available: false } },
];

/** One picker per state, laid out like a Figma sheet. */
function Sheet() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "24px 32px", padding: 8 }}>
      {STATES.map(({ name, option, chosen }) => (
        <VariantPicker
          key={name}
          legend={name}
          name={name}
          options={[option]}
          defaultValue={chosen ? option.value : undefined}
        />
      ))}
    </div>
  );
}

/** Default, hover, focus, chosen, chosen with focus, not available. */
export const AllStatesLight: Story = { name: "All states, light", render: () => <Sheet /> };

export const AllStatesDark: Story = {
  name: "All states, dark",
  parameters: { theme: "dark" },
  render: () => <Sheet />,
};
