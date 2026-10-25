export const extensionConfig = {
  id: 'kubohiroyaruntimeexpression',
  slug: 'runtime-expression',
  name: 'Runtime Expression',
  description:
    'Safely evaluate JavaScript-like conditions over Temporary Variables runtime variables.',
  author: 'Hiroya Kubo',
  license: 'MPL-2.0',
  unsandboxed: true,
  docsURI: 'https://kubohiroya.github.io/turbowarp-runtime-expression/',
  color1: '#6f5bd3',
  color2: '#5845b8',
  color3: '#40328e',
  blockIconURI: `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M6 36h13V14h23" fill="none" stroke="#E6533C" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="19" cy="25" r="5" fill="#FFAB19"/></svg>'
  )}`
} as const;
