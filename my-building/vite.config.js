import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'

// https://vite.dev/config/


export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    proxy: {
      "/chat": "http://127.0.0.1:8010",
      "/health": "http://127.0.0.1:8010",
      "/power_5min": "http://127.0.0.1:3000",
        "/temperature_data": "http://127.0.0.1:3000",
        "/temperature_mean": "http://127.0.0.1:3000",
      "/gatebms__": "http://127.0.0.1:3001",
      "/ts_": "http://127.0.0.1:3001",
    },
  },
});