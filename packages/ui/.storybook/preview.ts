import type { Preview } from "@storybook/react-vite";
import { createElement } from "react";
// The design tokens as CSS variables, as every app that uses the components loads them.
import "../src/theme.css";

// A story with `parameters: { theme: "dark" }` renders on the dark theme's page colour, whatever
// the viewer's system setting, so the light and dark mockups can sit side by side.
const darkPage = {
  background: "var(--mb-color-surface-page)",
  color: "var(--mb-color-text-default)",
  padding: "24px",
};

const preview: Preview = {
  // Every component gets a generated docs page from its stories and prop types.
  tags: ["autodocs"],
  decorators: [
    (Story, { parameters }) =>
      parameters.theme === "dark"
        ? createElement("div", { "data-theme": "dark", style: darkPage }, createElement(Story))
        : createElement(Story),
  ],
};

export default preview;
