import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    envPrefix: ["VITE_", "NEXT_PUBLIC_", "SUPABASE_"],
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    define: {
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || env.SUPABASE_URL,
      ),
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY,
      ),
      "process.env.SUPABASE_URL": JSON.stringify(
        env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL,
      ),
      "process.env.SUPABASE_ANON_KEY": JSON.stringify(
        env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
      ),
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
