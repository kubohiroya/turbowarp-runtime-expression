import {RuntimeExpressionExtension} from './extension.js';

if (!Scratch.extensions.unsandboxed) {
  throw new Error('Runtime Expression must run unsandboxed.');
}

Scratch.extensions.register(new RuntimeExpressionExtension());
