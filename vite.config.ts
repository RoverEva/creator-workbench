import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  // Single-file output: dist/index.html is the whole app, so it can be opened
  // anywhere without a server. Data still lives in the browser's localStorage.
  plugins: [react(), viteSingleFile()],
});
