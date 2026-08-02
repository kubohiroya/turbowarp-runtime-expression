import {describe, expect, it, vi} from 'vitest';
import {
  collectRuntimeVariableNames,
  ConditionEvaluator,
  ConditionSyntaxError,
  MAX_CACHE_ENTRIES,
  MAX_EXPRESSION_LENGTH,
  MAX_PARSE_DEPTH,
  parseCondition,
  tokenizeCondition,
  validateConditionSyntax
} from '../src/condition.js';

function resolver(values: Record<string, unknown>) {
  return (name: string): unknown => values[name];
}

describe('safe runtime condition evaluator', () => {
  it('applies JavaScript-like operator precedence and parentheses', () => {
    const evaluator = new ConditionEvaluator();
    expect(evaluator.evaluate('1 + 2 * 3 === 7', resolver({}))).toBe(true);
    expect(evaluator.evaluate('(1 + 2) * 3 === 9', resolver({}))).toBe(true);
    expect(evaluator.evaluate('false || true && false', resolver({}))).toBe(false);
    expect(evaluator.evaluate('!(false || false)', resolver({}))).toBe(true);
  });

  it('supports loose and strict equality with runtime variable values', () => {
    const evaluator = new ConditionEvaluator();
    const resolve = resolver({count: '3', ready: 'yes'});
    expect(evaluator.evaluate('count == 3', resolve)).toBe(true);
    expect(evaluator.evaluate('count === 3', resolve)).toBe(false);
    expect(evaluator.evaluate('ready != "no"', resolve)).toBe(true);
    expect(evaluator.evaluate('ready !== "yes"', resolve)).toBe(false);
  });

  it('supports unary, arithmetic, comparison, and string operations', () => {
    const evaluator = new ConditionEvaluator();
    const resolve = resolver({count: '5', prefix: 'go'});
    expect(evaluator.evaluate('+count >= 5 && -count < 0', resolve)).toBe(true);
    expect(evaluator.evaluate('10 / 2 + 1 === 6', resolve)).toBe(true);
    expect(evaluator.evaluate('10 % 4 === 2', resolve)).toBe(true);
    expect(evaluator.evaluate('prefix + "al" === "goal"', resolve)).toBe(true);
  });

  it('short-circuits logical operators', () => {
    const resolve = vi.fn((name: string) => name === 'left');
    const evaluator = new ConditionEvaluator();
    expect(evaluator.evaluate('left || right', resolve)).toBe(true);
    expect(resolve).toHaveBeenCalledTimes(1);

    resolve.mockClear();
    expect(evaluator.evaluate('missing && right', resolve)).toBe(false);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('supports quoted variable names and missing variables', () => {
    const evaluator = new ConditionEvaluator();
    const resolve = resolver({'日本語 変数': '値', true: 'runtime true'});
    expect(evaluator.evaluate('vars["日本語 変数"] == "値"', resolve)).toBe(true);
    expect(evaluator.evaluate('missing === undefined', resolve)).toBe(true);
    expect(evaluator.evaluate('vars["true"] === "runtime true"', resolve)).toBe(true);
  });

  it('collects unique runtime variable dependencies in source order', () => {
    const expression = parseCondition(
      'state == "ready" && vars["日本語 変数"] > score || state'
    );
    expect(collectRuntimeVariableNames(expression))
      .toEqual(['state', '日本語 変数', 'score']);
  });

  it('supports documented string escapes', () => {
    const evaluator = new ConditionEvaluator();
    expect(evaluator.evaluate('"a\\n\\t\\u0042" === "a\\n\\tB"', resolver({}))).toBe(true);
    expect(evaluator.evaluate("'it\\'s' === \"it's\"", resolver({}))).toBe(true);
  });

  it.each([
    'a = 1',
    'globalThis.alert(1)',
    'constructor.constructor("return globalThis")()',
    'vars[name]',
    'vars.x',
    'a["x"]',
    'new Date()',
    '`template`',
    '[1, 2]',
    '({x: 1})',
    'a?.b'
  ])('rejects unsupported or unsafe syntax: %s', (expression) => {
    expect(() => parseCondition(expression)).toThrow(ConditionSyntaxError);
  });

  it('reports syntax positions for malformed input', () => {
    expect(() => parseCondition('a && )')).toThrow('position 5');
    expect(() => parseCondition('"unterminated')).toThrow('position 0');
    expect(() => parseCondition('')).toThrow('Expression is empty at position 0');
  });

  it('returns a syntax-only validation result without evaluating the expression', () => {
    expect(validateConditionSyntax('missingVariable === undefined')).toEqual({ok: true});
    expect(validateConditionSyntax('a && )')).toEqual({
      ok: false,
      code: 'CONDITION_SYNTAX_ERROR',
      position: 5,
      message: 'Expected a literal, variable, or parenthesized expression at position 5.'
    });
  });

  it('enforces expression, token, nesting, and cache limits', () => {
    expect(() => tokenizeCondition('x'.repeat(MAX_EXPRESSION_LENGTH + 1)))
      .toThrow(`Expression exceeds the ${MAX_EXPRESSION_LENGTH} character limit`);
    expect(() => tokenizeCondition(Array.from({length: 513}, () => 'x').join(' ')))
      .toThrow('token limit');
    expect(() => parseCondition(`${'!'.repeat(MAX_PARSE_DEPTH + 1)}true`))
      .toThrow('nesting limit');

    const evaluator = new ConditionEvaluator();
    for (let index = 0; index < MAX_CACHE_ENTRIES + 10; index += 1) {
      evaluator.evaluate(`${index} === ${index}`, resolver({}));
    }
    const internals = evaluator as unknown as {cache: Map<string, unknown>};
    expect(internals.cache.size).toBe(MAX_CACHE_ENTRIES);
  });
});
