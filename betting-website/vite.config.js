import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const removeGoogleFonts = {
    name: "remove-google-fonts",
    enforce: "post",
    generateBundle(_, bundle) {
        for (const file of Object.values(bundle)) {
            if (file.type === "asset" && file.fileName.endsWith(".css")) {
                file.source = String(file.source).replace(
                    /@import\s*["']https:\/\/fonts\.googleapis\.com\/[^"']+["'];?/g,
                    ""
                );
            }
        }
    }
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    removeGoogleFonts
  ],
  // server: {
  //   port: 3000,
  // },
})
