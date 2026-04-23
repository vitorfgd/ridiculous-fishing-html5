import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/ridiculous-fishing-html5/" : "/",
  server: {
    host: true,
  },
}));
