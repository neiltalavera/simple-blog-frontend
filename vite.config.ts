import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: { '/api': 'https://5iyzw5ubhdav5caplypieaawc40giuvf.lambda-url.ap-southeast-2.on.aws' },
  },
})
