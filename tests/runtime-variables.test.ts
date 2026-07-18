import {describe, expect, it, vi} from 'vitest';
import {
  getRuntimeVariablesIfAvailable,
  readRuntimeVariable,
  readRuntimeVariableState,
  requireRuntimeVariables
} from '../src/runtime-variables.js';

function createExtension(values = new Map<string, unknown>()): TemporaryVariablesExtension {
  return {
    setRuntimeVariable: vi.fn(),
    getRuntimeVariable: vi.fn(({VAR}: {VAR: string}) => values.get(VAR) ?? ''),
    runtimeVariableExists: vi.fn(({VAR}: {VAR: string}) => values.has(VAR))
  };
}

describe('Temporary Variables adapter', () => {
  it('validates and returns the public extension API', () => {
    const extension = createExtension();
    expect(getRuntimeVariablesIfAvailable({ext_lmsTempVars2: extension}))
      .toBe(extension);
    expect(requireRuntimeVariables({ext_lmsTempVars2: extension})).toBe(extension);
  });

  it('rejects a missing or incomplete extension API', () => {
    expect(getRuntimeVariablesIfAvailable({})).toBeUndefined();
    expect(getRuntimeVariablesIfAvailable({
      ext_lmsTempVars2: {getRuntimeVariable: vi.fn()}
    } as unknown as TurboWarpRuntime)).toBeUndefined();
    expect(() => requireRuntimeVariables({})).toThrow('Temporary Variables');
    expect(() => requireRuntimeVariables({
      ext_lmsTempVars2: {getRuntimeVariable: vi.fn()}
    } as unknown as TurboWarpRuntime)).toThrow('Temporary Variables');
  });

  it('distinguishes a missing variable from an existing empty value', () => {
    const values = new Map<string, unknown>([['empty', '']]);
    const extension = createExtension(values);
    expect(readRuntimeVariable(extension, 'empty')).toBe('');
    expect(readRuntimeVariable(extension, 'missing')).toBeUndefined();
    expect(readRuntimeVariableState(extension, 'empty'))
      .toEqual({exists: true, value: ''});
    expect(readRuntimeVariableState(extension, 'missing'))
      .toEqual({exists: false, value: undefined});
  });
});
