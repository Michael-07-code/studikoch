import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Siehe https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Erlaubt Zugriff von anderen Geräten im selben WLAN (z. B. Handy),
    // wenn du "npm run dev -- --host" ausführst.
    host: true,
  },
})
