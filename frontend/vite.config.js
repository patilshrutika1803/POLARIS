import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Basic Vite + React setup. No extra config needed for now.
export default defineConfig({
  plugins: [react()],
});
