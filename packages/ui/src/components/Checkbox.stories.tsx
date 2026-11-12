import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "./Checkbox";

const meta = {
  title: "Forms/Checkbox",
  component: Checkbox,
  args: { label: "Accept the terms" },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Ticked: Story = { args: { defaultChecked: true } };

export const WithError: Story = { name: "Error", args: { error: "Tick the box to continue" } };

export const Disabled: Story = { args: { disabled: true } };

const states = ["default", "focus", "error", "disabled"] as const;

/** Unticked and ticked in every state, laid out like the Figma sheet: one state per column. */
function Sheet() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, max-content)",
        gap: "32px 48px",
        padding: 8,
      }}
    >
      {[false, true].flatMap((ticked) =>
        states.map((state) => (
          <Checkbox
            key={`${ticked}-${state}`}
            label="Accept the terms"
            defaultChecked={ticked}
            error={state === "error" ? "Tick the box to continue" : undefined}
            disabled={state === "disabled"}
            data-preview={state === "focus" ? "focus" : undefined}
          />
        )),
      )}
    </div>
  );
}

/** Columns: default, focus, error, disabled. Rows: unticked, then ticked. */
export const AllStatesLight: Story = { name: "All states, light", render: () => <Sheet /> };

export const AllStatesDark: Story = {
  name: "All states, dark",
  parameters: { theme: "dark" },
  render: () => <Sheet />,
};
