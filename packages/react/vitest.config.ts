import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run before `pnpm -r build` in CI, so resolve the workspace dependency
// to its source instead of its (possibly missing) dist, like tsconfig `paths`.
export default defineConfig({
  resolve: {
    alias: {
      "chladni-orb-core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
    },
  },
});
