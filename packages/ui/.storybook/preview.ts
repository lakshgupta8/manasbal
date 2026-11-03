import type { Preview } from "@storybook/react-vite";
// The design tokens as CSS variables, as every app that uses the components loads them.
import "../src/theme.css";

const preview: Preview = {
  // Every component gets a generated docs page from its stories and prop types.
  tags: ["autodocs"],
};

export default preview;
