import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {localVitePerimeter,PRIVATE_WORKSPACE_FS_DENY,WORKSPACE_VITE_FS_DENY} from './server/security/vitePerimeter.ts';

export default defineConfig(() => {
  return {
    plugins: [localVitePerimeter(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '127.0.0.1',
      allowedHosts: ['localhost'],
      strictPort: true,
      cors: false,
      fs: {deny:[...WORKSPACE_VITE_FS_DENY]},
      ws: false as const,
      // Containment disables auxiliary WebSocket/HMR listeners; reload manually.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: [...PRIVATE_WORKSPACE_FS_DENY, '**/docs/**'],
      },
    },
    preview: {host:'127.0.0.1',allowedHosts:['localhost'],strictPort:true,cors:false},
  };
});
