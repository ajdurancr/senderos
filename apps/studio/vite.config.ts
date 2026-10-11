import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  // Keep native libSQL resolution inside its installed package. Core itself
  // remains bundled because its workspace export is TypeScript source.
  ssr: { external: ["@libsql/client", "drizzle-orm"] },
  resolve: {
    tsconfigPaths: true,
  },
});
