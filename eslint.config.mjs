import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Prisma SQLite client (minified binaries, bukan kode kita):
    "src/lib/prisma-sqlite/**",
    // Skrip utilitas/debug satu kali, bukan kode produksi:
    "scripts/**",
    // Output test coverage Vitest:
    "coverage/**",
  ]),
  {
    // Aturan kustom proyek
    rules: {
      // React Compiler menandai pola `useEffect(() => { fetchData(); }, [fetchData])`
      // sebagai "set-state-in-effect" — ini false positive untuk pola async data-fetching
      // standar di Next.js. Turunkan ke warning agar tidak memblokir CI.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
