import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  // Safety guard: block production builds with demo mode enabled
  if (mode === 'production' && env.VITE_DEMO_MODE === 'true') {
    throw new Error(
      'VITE_DEMO_MODE=true is not allowed in production builds. ' +
      'Set VITE_DEMO_MODE=false or remove it from your environment.'
    );
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || '0.1.0'),
    },
    build: {
      target: 'es2020',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query'],
            charts: ['chart.js', 'react-chartjs-2'],
          },
        },
      },
      ...(mode === 'production' && {
        esbuild: {
          drop: ['console', 'debugger'],
        },
      }),
    },
  };
});
