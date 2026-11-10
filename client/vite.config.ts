import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Vite plugin to serve ONNX Runtime Web WASM and MJS binaries cleanly
// without tripping Vite's transform middleware for files in /public
function wasmServePlugin() {
  return {
    name: 'wasm-serve-plugin',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = req.url || '';
        if (url.startsWith('/wasm/')) {
          const cleanUrl = url.split('?')[0].replace(/^\/wasm\//, '');
          const filePath = path.resolve(__dirname, 'public/wasm', cleanUrl);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            if (cleanUrl.endsWith('.wasm')) {
              res.setHeader('Content-Type', 'application/wasm');
            } else if (cleanUrl.endsWith('.mjs') || cleanUrl.endsWith('.js')) {
              res.setHeader('Content-Type', 'application/javascript');
            }
            res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            return fs.createReadStream(filePath).pipe(res);
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), wasmServePlugin()],
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  server: {
    host: true,
    port: 5173,
    hmr: {
      overlay: false, // Prevents blocking red error overlay from stopping clinical workflow
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    watch: {
      ignored: ['**/assets/videos/**', '**/*.mp4'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
