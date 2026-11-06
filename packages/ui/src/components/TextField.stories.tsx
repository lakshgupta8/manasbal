import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextField, type TextFieldProps } from "./TextField";

const meta = {
  title: "Forms/TextField",
  component: TextField,
  args: {
    label: "Email",
    type: "email",
    defaultValue: "name@example.test",
    hint: "We use it only to sign you in",
  },
  argTypes: {
    type: { control: "select", options: ["text", "email", "password", "tel", "url", "search"] },
  },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

// One field fills its column in a form; the Figma sheet draws it 320px wide.
const column: Story["decorators"] = [
  (Story) => (
    <div style={{ width: 320, padding: 8 }}>
      <Story />
    </div>
  ),
];

export const Default: Story = { decorators: column };

export const WithError: Story = {
  name: "Error",
  decorators: column,
  args: { error: "Enter an email like name@example.test" },
};

export const Disabled: Story = { decorators: column, args: { disabled: true } };

export const Password: Story = {
  decorators: column,
  args: {
    label: "Password",
    type: "password",
    required: true,
    defaultValue: "demo-password",
    hint: "At least 12 characters",
  },
};

const email: TextFieldProps = {
  label: "Email",
  type: "email",
  defaultValue: "name@example.test",
  hint: "We use it only to sign you in",
};
const password: TextFieldProps = {
  label: "Password",
  type: "password",
  required: true,
  defaultValue: "demo-password",
  hint: "At least 12 characters",
};
const errors = new Map([
  [email, "Enter an email like name@example.test"],
  [password, "Use at least 12 characters"],
]);
const states = ["default", "focus", "error", "disabled"] as const;

/** Both versions in every state, laid out like the Figma sheet: one state per column. */
function Sheet() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 320px)",
        gap: "48px 32px",
        padding: 8,
      }}
    >
      {[email, password].flatMap((field) =>
        states.map((state) => (
          <TextField
            key={`${field.label}-${state}`}
            {...field}
            error={state === "error" ? errors.get(field) : undefined}
            disabled={state === "disabled"}
            data-preview={state === "focus" ? "focus" : undefined}
          />
        )),
      )}
    </div>
  );
}

/** Columns: default, focus, error, disabled. Rows: email, then password. */
export const AllStatesLight: Story = {
  name: "All states, light",
  // The "wide" tag makes the visual test render this story on a 1600px screen: four 320px fields.
  tags: ["wide"],
  render: () => <Sheet />,
};

export const AllStatesDark: Story = {
  name: "All states, dark",
  tags: ["wide"],
  render: () => <Sheet />,
  parameters: { theme: "dark" },
};
