import {defineConfig} from 'vite';
import {turboWarpExtension} from '@kubohiroya/vite-plugin-turbowarp-extension';

export default defineConfig({
  plugins: [
    turboWarpExtension({
      id: 'kubohiroyaruntimeexpression',
      name: 'Runtime Expression',
      description: 'Safely evaluate JavaScript-like conditions over Temporary Variables runtime variables.',
      author: 'Hiroya Kubo',
      license: 'MPL-2.0',
      fileName: 'runtime-expression.js'
    })
  ]
});
