import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const cdnBaseUrl = (env.VITE_CDN_BASE_URL ?? "").trim();

  return {
    envDir: repoRoot,
    plugins: [vue()],
    define: {
      __INTLIFY_JIT_COMPILATION__: true,
      __INTLIFY_DROP_MESSAGE_COMPILER__: false
    },
    base: cdnBaseUrl || "/",
    server: {
      port: 5173,
    },
  };
});
