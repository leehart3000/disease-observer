import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // App code must use `@/db` (which is server-only), not the raw client
  // that scripts use.
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "(^@/db/client|(^|/)db/client)(\\.ts)?$|^\\./client(\\.ts)?$",
              message: "Import from @/db instead, so the server-only guard applies.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Files built by `pnpm maplibre:worker`, copied from node_modules.
    "public/maplibre/**",
  ]),
]);

export default eslintConfig;
