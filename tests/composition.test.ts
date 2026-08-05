import {describe, expect, it, vi} from 'vitest';

import {
  createRuntimeExpressionComposition,
  RuntimeExpressionCompositionError
} from '../src/composition.js';
import {
  ConditionEvaluator,
  MAX_CACHE_ENTRIES,
  MAX_EXPRESSION_LENGTH,
  MAX_PARSE_DEPTH,
  MAX_TOKEN_COUNT
} from '../src/condition.js';

describe('Runtime Expression composition API', () => {
  it('creates a frozen evaluator without reading host globals', () => {
    const names = ['Scratch', 'document', 'fetch', 'localStorage'] as const;
    const originals = new Map(
      names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
    );
    for (const name of names) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get() {
          throw new Error(`${name} must not be read`);
        }
      });
    }

    try {
      const composition = createRuntimeExpressionComposition();
      expect(Object.isFrozen(composition)).toBe(true);
    } finally {
      for (const name of names) {
        const original = originals.get(name);
        if (original) Object.defineProperty(globalThis, name, original);
        else Reflect.deleteProperty(globalThis, name);
      }
    }
  });

  it('evaluates the shared expression grammar against an own-property snapshot', () => {
    const composition = createRuntimeExpressionComposition();
    const variables = Object.create(null) as Record<string, string | number | boolean>;
    variables.state = 'ready';
    variables['日本語 変数'] = '値';
    variables['constructor'] = 'own value';
    variables.score = 10;

    expect(composition.evaluateCondition(
      'state == "ready" && vars["日本語 変数"] === "値" && score >= 10',
      variables
    )).toBe(true);
    expect(composition.evaluateCondition(
      'vars["constructor"] === "own value"',
      variables
    )).toBe(true);
    expect(composition.evaluateCondition('state === "ready"', {state: 'ready'}))
      .toBe(true);
    expect(composition.evaluateCondition('state === "ready"', {state: 'waiting'}))
      .toBe(false);
  });

  it('keeps short-circuit evaluation while diagnosing a referenced unknown variable', () => {
    const composition = createRuntimeExpressionComposition();
    expect(composition.evaluateCondition('false && missing', {})).toBe(false);
    expect(() => composition.evaluateCondition('true && missing', {}))
      .toThrowError(expect.objectContaining({
        name: 'RuntimeExpressionCompositionError',
        code: 'RUNTIME_EXPRESSION_UNKNOWN_VARIABLE',
        variableName: 'missing'
      }));
    expect(() => composition.evaluateCondition('constructor === "inherited"', {}))
      .toThrowError(expect.objectContaining({
        code: 'RUNTIME_EXPRESSION_UNKNOWN_VARIABLE',
        variableName: 'constructor'
      }));
  });

  it('rejects non-plain maps, accessors, symbols, and unsupported values without invoking getters', () => {
    const composition = createRuntimeExpressionComposition();
    const getter = vi.fn(() => 'ready');
    const accessor = Object.defineProperty({}, 'state', {
      enumerable: true,
      get: getter
    });
    const symbolMap = {[Symbol('state')]: 'ready'};

    for (const variables of [null, [], new Date(), new Map()]) {
      expect(() => composition.evaluateCondition('true', variables as never))
        .toThrowError(expect.objectContaining({
          code: 'RUNTIME_EXPRESSION_INVALID_VARIABLE_MAP'
        }));
    }
    expect(() => composition.evaluateCondition('state === "ready"', accessor as never))
      .toThrowError(expect.objectContaining({
        code: 'RUNTIME_EXPRESSION_INVALID_VARIABLE_PROPERTY',
        variableName: 'state'
      }));
    expect(getter).not.toHaveBeenCalled();
    expect(() => composition.evaluateCondition('true', symbolMap as never))
      .toThrowError(expect.objectContaining({
        code: 'RUNTIME_EXPRESSION_INVALID_VARIABLE_PROPERTY'
      }));

    for (const value of [Number.NaN, Infinity, null, undefined, {}, 1n]) {
      expect(() => composition.evaluateCondition('value', {value} as never))
        .toThrowError(expect.objectContaining({
          code: 'RUNTIME_EXPRESSION_INVALID_VARIABLE_VALUE',
          variableName: 'value'
        }));
    }
  });

  it('preserves shared syntax diagnostics and parser limits', () => {
    const composition = createRuntimeExpressionComposition();
    expect(composition.validateConditionSyntax('a && )')).toEqual({
      ok: false,
      code: 'CONDITION_SYNTAX_ERROR',
      position: 5,
      message: 'Expected a literal, variable, or parenthesized expression at position 5.'
    });
    expect(composition.validateConditionSyntax('vars["日本語"] === "値"'))
      .toEqual({ok: true});
    expect(() => composition.evaluateCondition(
      'x'.repeat(MAX_EXPRESSION_LENGTH + 1),
      {x: true}
    )).toThrow(`Expression exceeds the ${MAX_EXPRESSION_LENGTH} character limit`);
    expect(() => composition.evaluateCondition(
      Array.from({length: MAX_TOKEN_COUNT + 1}, () => 'x').join(' '),
      {x: true}
    )).toThrow(`Expression exceeds the ${MAX_TOKEN_COUNT} token limit`);
    expect(() => composition.evaluateCondition(
      `${'!'.repeat(MAX_PARSE_DEPTH + 1)}true`,
      {}
    )).toThrow(`Expression exceeds the ${MAX_PARSE_DEPTH} nesting limit`);
  });

  it('bounds and releases the shared parse cache while remaining reusable', () => {
    const clearCache = vi.spyOn(ConditionEvaluator.prototype, 'clearCache');
    const composition = createRuntimeExpressionComposition();
    for (let index = 0; index < MAX_CACHE_ENTRIES + 10; index += 1) {
      expect(composition.evaluateCondition(`${index} === ${index}`, {})).toBe(true);
    }

    composition.releaseAll();
    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(composition.evaluateCondition('true', {})).toBe(true);
    clearCache.mockRestore();
  });

  it('exports a stable typed diagnostic class', () => {
    const error = new RuntimeExpressionCompositionError(
      'RUNTIME_EXPRESSION_UNKNOWN_VARIABLE',
      'missing',
      'state'
    );
    expect(error).toMatchObject({
      name: 'RuntimeExpressionCompositionError',
      code: 'RUNTIME_EXPRESSION_UNKNOWN_VARIABLE',
      variableName: 'state',
      message: 'missing'
    });
  });
});
