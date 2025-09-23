import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/bin.ts"],
  clean: true,
  publicDir: true,
  treeshake: true, // Re-enable treeshaking for ESM
  external: ["@parcel/watcher"],
  minify: process.env.NODE_ENV === "production", // Enable minification for production builds
  splitting: false,
  format: ["esm"], // Change to ESM for Effect compatibility
  target: "node20", // Update to more recent Node.js version
  shims: true, // Enable shims for Node.js compatibility in ESM
  bundle: true, // Ensure bundling is enabled
  sourcemap: process.env.NODE_ENV !== "production" // Source maps only for dev builds
})
