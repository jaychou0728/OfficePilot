import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@officepilot/shared'],
  // tsup strips the `node:` prefix by default. `sqlite` is not a resolvable
  // bare specifier (only `node:sqlite` is a builtin), so `npm start` would
  // crash with ERR_MODULE_NOT_FOUND. Keep the protocol on all builtin imports.
  removeNodeProtocol: false,
});
