import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2020",
    minify: false,
  },
  {
    entry: { widget: "src/iife.ts" },
    format: ["iife"],
    globalName: "ArtID",
    sourcemap: false,
    target: "es2018",
    minify: true,
    dts: false,
    outExtension: () => ({ js: ".js" }),
  },
]);
