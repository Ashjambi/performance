import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // This makes the environment variable available to your service file
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
})