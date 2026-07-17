import {beforeEach, describe, expect, it, vi} from 'vitest';
import {FEATURE_FLAGS} from '../config/feature-flags.js';
import {RuntimeExpressionExtension} from '../src/extension.js';

describe('Runtime Expression extension', () => {
  const values = new Map<string, unknown>();

  beforeEach(() => {
    values.clear();
    vi.stubGlobal('Scratch', {
      vm: {
        runtime: {
          ext_lmsTempVars2: {
            setRuntimeVariable: vi.fn(),
            getRuntimeVariable: ({VAR}: {VAR: string}) => values.get(VAR) ?? '',
            runtimeVariableExists: ({VAR}: {VAR: string}) => values.has(VAR)
          }
        }
      },
      extensions: {unsandboxed: true, register: vi.fn()},
      BlockType: {COMMAND: 'command', BOOLEAN: 'boolean', REPORTER: 'reporter'},
      ArgumentType: {STRING: 'string'},
      translate: (text: string) => text
    });
  });

  it('evaluates conditions through Temporary Variables', () => {
    values.set('state', 'ready');
    values.set('count', '4');
    const extension = new RuntimeExpressionExtension();
    expect(extension.runtimeCondition({
      EXPRESSION: 'state == "ready" && count > 3'
    })).toBe(true);
  });

  it('requires Temporary Variables when evaluating', () => {
    const extension = new RuntimeExpressionExtension();
    delete Scratch.vm.runtime.ext_lmsTempVars2;
    expect(() => extension.runtimeCondition({EXPRESSION: 'true'}))
      .toThrow('Temporary Variables');
  });

  it('keeps the condition block hidden while the feature flag is off', () => {
    expect(FEATURE_FLAGS.runtimeExpression).toBe(false);
    expect(new RuntimeExpressionExtension().getInfo().blocks).toEqual([]);
  });
});
