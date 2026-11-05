import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function bundleServerIntegrations() {
  return {
    name: 'bundle-server-integrations',
    async closeBundle() {
      const { build } = await import('esbuild');
      await build({
        entryPoints: [path.resolve(import.meta.dirname || '.', 'src/services/integrations/registry.ts')],
        bundle: true,
        platform: 'node',
        format: 'esm',
        outfile: path.resolve(import.meta.dirname || '.', 'dist/integrations.js'),
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), bundleServerIntegrations()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
