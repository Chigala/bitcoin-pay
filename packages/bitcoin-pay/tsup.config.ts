import { defineConfig } from "tsup";

export default defineConfig((env) => {
  return {
    entry: {
      index: "./src/index.ts",
      client: "./src/client/index.ts",
      react: "./src/client/react/index.ts",
      vue: "./src/client/vue/index.ts",
      svelte: "./src/client/svelte/index.ts",
      "adapters/drizzle": "./src/adapters/drizzle-adapter/index.ts",
      "adapters/prisma": "./src/adapters/prisma-adapter/index.ts",
    },
    format: ["esm", "cjs"],
    bundle: true,
    splitting: false,
    cjsInterop: true,
    skipNodeModulesBundle: true,
    external: ["bitcoinjs-lib", "zeromq", "@tanstack/react-query"],
  };
});
