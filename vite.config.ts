import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(() => {
  const isCapacitorBuild = process.env.CAPACITOR_BUILD === "true";

  return {
    base: "./",
    server: {
      host: "0.0.0.0",
      port: 8080,
      strictPort: true,
    },
    preview: {
      host: "127.0.0.1",
      port: 8081,
      strictPort: true,
    },
    resolve: { tsconfigPaths: true },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    plugins: [
      tailwindcss(),
      tanstackStart(
        isCapacitorBuild
          ? {
              spa: {
                enabled: true,
              },
            }
          : {}
      ),
      viteReact(),
    ],
  };
});