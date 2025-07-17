import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    base: '/',
    plugins: [react()],
    define: {
      // Vite will replace `process.env.API_KEY` with the value of the API_KEY
      // environment variable available during the build process.
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
    }
  }
})