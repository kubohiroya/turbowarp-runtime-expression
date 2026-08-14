import {beforeEach, describe, expect, it, vi} from 'vitest';
import {FEATURE_FLAGS} from '../config/feature-flags.js';
import {
  BLOCK_ICON_URI,
  DOCS_URI,
  RuntimeExpressionExtension
} from '../src/extension.js';

describe('Runtime Expression extension', () => {
  const values = new Map<string, unknown>();
  const listeners = new Map<string, Array<() => void>>();
  const startHats = vi.fn(() => []);
  const getRuntimeVariable = vi.fn(
    ({VAR}: {VAR: string}) => values.get(VAR) ?? ''
  );

  const emit = (event: string): void => {
    for (const listener of listeners.get(event) ?? []) listener();
  };

  beforeEach(() => {
    values.clear();
    listeners.clear();
    startHats.mockClear();
    getRuntimeVariable.mockClear();
    vi.stubGlobal('Scratch', {
      vm: {
        runtime: {
          ext_lmsTempVars2: {
            setRuntimeVariable: vi.fn(),
            getRuntimeVariable,
            runtimeVariableExists: ({VAR}: {VAR: string}) => values.has(VAR)
          },
          on: (event: string, listener: () => void) => {
            const eventListeners = listeners.get(event) ?? [];
            eventListeners.push(listener);
            listeners.set(event, eventListeners);
          },
          startHats
        }
      },
      extensions: {unsandboxed: true, register: vi.fn()},
      BlockType: {COMMAND: 'command', BOOLEAN: 'boolean', REPORTER: 'reporter'},
      ArgumentType: {NUMBER: 'number', STRING: 'string'},
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

  it('validates syntax without reading or evaluating runtime variables', () => {
    const extension = new RuntimeExpressionExtension();
    expect(JSON.parse(extension.validateConditionSyntax({
      EXPRESSION: 'missingVariable === undefined'
    }))).toEqual({ok: true});
    expect(JSON.parse(extension.validateConditionSyntax({
      EXPRESSION: 'a && )'
    }))).toMatchObject({
      ok: false,
      code: 'CONDITION_SYNTAX_ERROR',
      position: 5
    });
    expect(getRuntimeVariable).not.toHaveBeenCalled();
  });

  it('enables all blocks by default', () => {
    expect(FEATURE_FLAGS.conditionalBroadcast).toBe(true);
    expect(FEATURE_FLAGS.runtimeExpression).toBe(true);
    expect(
      new RuntimeExpressionExtension().getInfo().blocks.map((block) => block.opcode)
    ).toEqual([
      'validateConditionSyntax',
      'runtimeCondition',
      'registerConditionalBroadcast',
      'unregisterConditionalBroadcast'
    ]);
    expect(
      new RuntimeExpressionExtension().getInfo().blocks[0]
    ).toMatchObject({hideFromPalette: true});
  });

  it('links the English-default GitHub Pages user guide', () => {
    const info = new RuntimeExpressionExtension().getInfo();
    expect(info.docsURI).toBe(DOCS_URI);
    expect(DOCS_URI).toBe(
      'https://kubohiroya.github.io/turbowarp-runtime-expression/'
    );
    expect(info.blockIconURI).toBe(BLOCK_ICON_URI);
    const iconSvg = decodeURIComponent(BLOCK_ICON_URI.slice('data:image/svg+xml,'.length));
    expect(iconSvg).toContain('viewBox="0 0 64 64"');
    expect(iconSvg).toContain('M7 32h13l12-12 12 12');
    expect(iconSvg).not.toContain('<rect');
  });

  it('registers frame monitoring and clears registrations on project lifecycle events', () => {
    values.set('state', 'idle');
    const extension = new RuntimeExpressionExtension();
    extension.registerConditionalBroadcast({
      ID: 'state',
      CONDITION: 'state == "ready"',
      MESSAGE_ON_TRUE: 'ready',
      MESSAGE_ON_FALSE: 'not ready',
      TIMEOUT: 0
    });

    expect(startHats).not.toHaveBeenCalled();
    values.set('state', 'ready');
    emit('BEFORE_EXECUTE');
    expect(startHats).toHaveBeenCalledWith(
      'event_whenbroadcastreceived',
      {BROADCAST_OPTION: 'ready'}
    );

    emit('PROJECT_STOP_ALL');
    values.set('state', 'idle');
    emit('BEFORE_EXECUTE');
    expect(startHats).toHaveBeenCalledTimes(1);

    extension.registerConditionalBroadcast({
      ID: 'state',
      CONDITION: 'state == "ready"',
      MESSAGE_ON_TRUE: 'ready',
      MESSAGE_ON_FALSE: 'not ready',
      TIMEOUT: 0
    });
    emit('PROJECT_START');
    values.set('state', 'ready');
    emit('BEFORE_EXECUTE');
    expect(startHats).toHaveBeenCalledTimes(1);
  });
});
