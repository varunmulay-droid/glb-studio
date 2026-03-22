import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Build output goes to dist/
  build: {
    outDir: 'dist',
    target: 'esnext',
    sourcemap: false,
    // Chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'r3f': ['@react-three/fiber', '@react-three/drei'],
          'react-vendor': ['react', 'react-dom'],
          'state': ['zustand'],
        },
      },
    },
    // Increase chunk size warning limit for Three.js
    chunkSizeWarningLimit: 3000,
  },

  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei', 'zustand', 'immer'],
  },

  server: {
    port: 5173,
    host: '0.0.0.0',
  },
})
