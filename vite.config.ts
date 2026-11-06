import { defineConfig } from "vite";
export default defineConfig({
  server: {
    proxy: {
      "/terrain": {
        target: "https://api.opentopodata.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/terrain/, ""),
      },
    },
  },
  preview: {
    proxy: {
      "/terrain": {
        target: "https://api.opentopodata.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/terrain/, ""),
      },
    },
  },
});
