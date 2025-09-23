import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/bin.ts"],
  clean: true,
  publicDir: true,
  treeshake: true, // Re-enable treeshaking for ESM
  external: ["@parcel/watcher"],
  minify: false, // Keep disabled for debugging
  splitting: false,
  format: ["esm"], // Change to ESM for Effect compatibility
  target: "node18",
  shims: true // Enable shims for Node.js compatibility in ESM
})
