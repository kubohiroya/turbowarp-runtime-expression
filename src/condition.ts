export const MAX_EXPRESSION_LENGTH = 4096;
export const MAX_TOKEN_COUNT = 512;
export const MAX_PARSE_DEPTH = 64;
export const MAX_CACHE_ENTRIES = 128;

type Punctuation = '(' | ')' | '[' | ']';
type UnaryOperator = '!' | '+' | '-';
type BinaryOperator =
  | '||' | '&&'
  | '==' | '!=' | '===' | '!=='
  | '<' | '<=' | '>' | '>='
  | '+' | '-' | '*' | '/' | '%';

export type ConditionToken =
  | {kind: 'number'; value: number; position: number}
  | {kind: 'string'; value: string; position: number}
  | {kind: 'identifier'; value: string; position: number}
  | {kind: 'operator'; value: UnaryOperator | BinaryOperator; position: number}
  | {kind: 'punctuation'; value: Punctuation; position: number}
  | {kind: 'eof'; position: number};

export type ConditionExpression =
  | {kind: 'literal'; value: unknown}
  | {kind: 'variable'; name: string}
  | {kind: 'unary'; operator: UnaryOperator; operand: ConditionExpression}
  | {
      kind: 'binary';
      operator: BinaryOperator;
      left: ConditionExpression;
      right: ConditionExpression;
    };

export function collectRuntimeVariableNames(
  expression: ConditionExpression
): string[] {
  const names = new Set<string>();

  const visit = (node: ConditionExpression): void => {
    switch (node.kind) {
      case 'literal':
        return;
      case 'variable':
        names.add(node.name);
        return;
      case 'unary':
        visit(node.operand);
        return;
      case 'binary':
        visit(node.left);
        visit(node.right);
    }
  };

  visit(expression);
  return [...names];
}

export type RuntimeVariableResolver = (name: string) => unknown;

const MULTI_CHAR_OPERATORS = [
  '===',
  '!==',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||'
] as const;

const SIMPLE_ESCAPES: Record<string, string> = {
  '\\': '\\',
  '"': '"',
  "'": "'",
  n: '\n',
  r: '\r',
  t: '\t'
};

export class ConditionSyntaxError extends Error {
  constructor(message: string, readonly position: number) {
    super(`${message} at position ${position}.`);
    this.name = 'ConditionSyntaxError';
  }
}

export type ConditionSyntaxValidation =
  | {ok: true}
  | {
      ok: false;
      code: 'CONDITION_SYNTAX_ERROR';
      position: number;
      message: string;
    };

export function tokenizeCondition(expression: string): ConditionToken[] {
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    throw new ConditionSyntaxError(
      `Expression exceeds the ${MAX_EXPRESSION_LENGTH} character limit`,
      MAX_EXPRESSION_LENGTH
    );
  }

  const tokens: ConditionToken[] = [];
  let index = 0;

  const push = (token: ConditionToken): void => {
    tokens.push(token);
    if (tokens.length > MAX_TOKEN_COUNT) {
      throw new ConditionSyntaxError(
        `Expression exceeds the ${MAX_TOKEN_COUNT} token limit`,
        token.position
      );
    }
  };

  while (index < expression.length) {
    const character = expression[index] as string;
    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }

    const position = index;
    const operator = MULTI_CHAR_OPERATORS.find(
      (candidate) => expression.startsWith(candidate, index)
    );
    if (operator) {
      push({kind: 'operator', value: operator, position});
      index += operator.length;
      continue;
    }

    if ('!+-*/%<>'.includes(character)) {
      push({
        kind: 'operator',
        value: character as UnaryOperator | BinaryOperator,
        position
      });
      index += 1;
      continue;
    }

    if ('()[]'.includes(character)) {
      push({kind: 'punctuation', value: character as Punctuation, position});
      index += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      const quote = character;
      let value = '';
      index += 1;
      let closed = false;
      while (index < expression.length) {
        const next = expression[index] as string;
        if (next === quote) {
          closed = true;
          index += 1;
          break;
        }
        if (next === '\n' || next === '\r') {
          throw new ConditionSyntaxError('Unescaped newline in string literal', index);
        }
        if (next !== '\\') {
          value += next;
          index += 1;
          continue;
        }

        const escapePosition = index;
        index += 1;
        const escaped = expression[index];
        if (escaped === undefined) {
          throw new ConditionSyntaxError('Unterminated string escape', escapePosition);
        }
        if (escaped === 'u') {
          const hexadecimal = expression.slice(index + 1, index + 5);
          if (!/^[0-9a-fA-F]{4}$/u.test(hexadecimal)) {
            throw new ConditionSyntaxError('Invalid Unicode escape', escapePosition);
          }
          value += String.fromCharCode(Number.parseInt(hexadecimal, 16));
          index += 5;
          continue;
        }
        const replacement = SIMPLE_ESCAPES[escaped];
        if (replacement === undefined) {
          throw new ConditionSyntaxError(`Unsupported string escape \\${escaped}`, escapePosition);
        }
        value += replacement;
        index += 1;
      }
      if (!closed) {
        throw new ConditionSyntaxError('Unterminated string literal', position);
      }
      push({kind: 'string', value, position});
      continue;
    }

    const rest = expression.slice(index);
    const numberMatch = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/u.exec(rest);
    if (numberMatch?.[0]) {
      const value = Number(numberMatch[0]);
      if (!Number.isFinite(value)) {
        throw new ConditionSyntaxError('Number literal must be finite', position);
      }
      push({kind: 'number', value, position});
      index += numberMatch[0].length;
      continue;
    }

    const identifierMatch = /^[A-Za-z_$][A-Za-z0-9_$]*/u.exec(rest);
    if (identifierMatch?.[0]) {
      push({kind: 'identifier', value: identifierMatch[0], position});
      index += identifierMatch[0].length;
      continue;
    }

    throw new ConditionSyntaxError(`Unexpected character ${JSON.stringify(character)}`, position);
  }

  push({kind: 'eof', position: expression.length});
  return tokens;
}

class ConditionParser {
  private index = 0;
  private depth = 0;

  constructor(private readonly tokens: readonly ConditionToken[]) {}

  parse(): ConditionExpression {
    if (this.current().kind === 'eof') {
      throw new ConditionSyntaxError('Expression is empty', this.current().position);
    }
    const expression = this.parseLogicalOr();
    const trailing = this.current();
    if (trailing.kind !== 'eof') {
      throw new ConditionSyntaxError('Unexpected trailing token', trailing.position);
    }
    return expression;
  }

  private parseLogicalOr(): ConditionExpression {
    let expression = this.parseLogicalAnd();
    while (this.matchOperator('||')) {
      expression = {
        kind: 'binary',
        operator: '||',
        left: expression,
        right: this.parseLogicalAnd()
      };
    }
    return expression;
  }

  private parseLogicalAnd(): ConditionExpression {
    let expression = this.parseEquality();
    while (this.matchOperator('&&')) {
      expression = {
        kind: 'binary',
        operator: '&&',
        left: expression,
        right: this.parseEquality()
      };
    }
    return expression;
  }

  private parseEquality(): ConditionExpression {
    let expression = this.parseRelational();
    while (this.isOperator('==', '!=', '===', '!==')) {
      const operator = this.advanceOperator() as '==' | '!=' | '===' | '!==';
      expression = {
        kind: 'binary',
        operator,
        left: expression,
        right: this.parseRelational()
      };
    }
    return expression;
  }

  private parseRelational(): ConditionExpression {
    let expression = this.parseAdditive();
    while (this.isOperator('<', '<=', '>', '>=')) {
      const operator = this.advanceOperator() as '<' | '<=' | '>' | '>=';
      expression = {
        kind: 'binary',
        operator,
        left: expression,
        right: this.parseAdditive()
      };
    }
    return expression;
  }

  private parseAdditive(): ConditionExpression {
    let expression = this.parseMultiplicative();
    while (this.isOperator('+', '-')) {
      const operator = this.advanceOperator() as '+' | '-';
      expression = {
        kind: 'binary',
        operator,
        left: expression,
        right: this.parseMultiplicative()
      };
    }
    return expression;
  }

  private parseMultiplicative(): ConditionExpression {
    let expression = this.parseUnary();
    while (this.isOperator('*', '/', '%')) {
      const operator = this.advanceOperator() as '*' | '/' | '%';
      expression = {
        kind: 'binary',
        operator,
        left: expression,
        right: this.parseUnary()
      };
    }
    return expression;
  }

  private parseUnary(): ConditionExpression {
    if (this.isOperator('!', '+', '-')) {
      const token = this.current();
      const operator = this.advanceOperator() as UnaryOperator;
      return this.withDepth(token.position, () => ({
        kind: 'unary',
        operator,
        operand: this.parseUnary()
      }));
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ConditionExpression {
    const token = this.current();
    if (token.kind === 'number' || token.kind === 'string') {
      this.index += 1;
      return {kind: 'literal', value: token.value};
    }
    if (token.kind === 'identifier') {
      this.index += 1;
      if (token.value === 'true') return {kind: 'literal', value: true};
      if (token.value === 'false') return {kind: 'literal', value: false};
      if (token.value === 'null') return {kind: 'literal', value: null};
      if (token.value === 'undefined') return {kind: 'literal', value: undefined};
      if (token.value === 'vars' && this.matchPunctuation('[')) {
        const nameToken = this.current();
        if (nameToken.kind !== 'string') {
          throw new ConditionSyntaxError(
            'vars[...] requires a string literal variable name',
            nameToken.position
          );
        }
        this.index += 1;
        this.expectPunctuation(']');
        return {kind: 'variable', name: nameToken.value};
      }
      return {kind: 'variable', name: token.value};
    }
    if (this.matchPunctuation('(')) {
      return this.withDepth(token.position, () => {
        const expression = this.parseLogicalOr();
        this.expectPunctuation(')');
        return expression;
      });
    }
    throw new ConditionSyntaxError('Expected a literal, variable, or parenthesized expression', token.position);
  }

  private withDepth<T>(position: number, action: () => T): T {
    this.depth += 1;
    if (this.depth > MAX_PARSE_DEPTH) {
      throw new ConditionSyntaxError(
        `Expression exceeds the ${MAX_PARSE_DEPTH} nesting limit`,
        position
      );
    }
    try {
      return action();
    } finally {
      this.depth -= 1;
    }
  }

  private current(): ConditionToken {
    return this.tokens[this.index] ?? {kind: 'eof', position: 0};
  }

  private isOperator(...operators: string[]): boolean {
    const token = this.current();
    return token.kind === 'operator' && operators.includes(token.value);
  }

  private matchOperator(operator: BinaryOperator): boolean {
    if (!this.isOperator(operator)) return false;
    this.index += 1;
    return true;
  }

  private advanceOperator(): UnaryOperator | BinaryOperator {
    const token = this.current();
    if (token.kind !== 'operator') {
      throw new ConditionSyntaxError('Expected an operator', token.position);
    }
    this.index += 1;
    return token.value;
  }

  private matchPunctuation(punctuation: Punctuation): boolean {
    const token = this.current();
    if (token.kind !== 'punctuation' || token.value !== punctuation) return false;
    this.index += 1;
    return true;
  }

  private expectPunctuation(punctuation: Punctuation): void {
    const token = this.current();
    if (token.kind !== 'punctuation' || token.value !== punctuation) {
      throw new ConditionSyntaxError(`Expected ${punctuation}`, token.position);
    }
    this.index += 1;
  }
}

export function parseCondition(expression: string): ConditionExpression {
  return new ConditionParser(tokenizeCondition(expression)).parse();
}

export function validateConditionSyntax(
  expression: string
): ConditionSyntaxValidation {
  try {
    parseCondition(expression);
    return {ok: true};
  } catch (error) {
    if (!(error instanceof ConditionSyntaxError)) throw error;
    return {
      ok: false,
      code: 'CONDITION_SYNTAX_ERROR',
      position: error.position,
      message: error.message
    };
  }
}

export function evaluateConditionExpression(
  expression: ConditionExpression,
  resolveVariable: RuntimeVariableResolver
): unknown {
  switch (expression.kind) {
    case 'literal':
      return expression.value;
    case 'variable':
      return resolveVariable(expression.name);
    case 'unary': {
      const value = evaluateConditionExpression(expression.operand, resolveVariable);
      if (expression.operator === '!') return !value;
      if (expression.operator === '+') return Number(value);
      return -Number(value);
    }
    case 'binary': {
      const left = evaluateConditionExpression(expression.left, resolveVariable);
      if (expression.operator === '&&') {
        return left && evaluateConditionExpression(expression.right, resolveVariable);
      }
      if (expression.operator === '||') {
        return left || evaluateConditionExpression(expression.right, resolveVariable);
      }
      const right = evaluateConditionExpression(expression.right, resolveVariable);
      switch (expression.operator) {
        case '==': return left == right;
        case '!=': return left != right;
        case '===': return left === right;
        case '!==': return left !== right;
        case '<': return (left as any) < (right as any);
        case '<=': return (left as any) <= (right as any);
        case '>': return (left as any) > (right as any);
        case '>=': return (left as any) >= (right as any);
        case '+': return (left as any) + (right as any);
        case '-': return (left as any) - (right as any);
        case '*': return (left as any) * (right as any);
        case '/': return (left as any) / (right as any);
        case '%': return (left as any) % (right as any);
      }
    }
  }
}

export class ConditionEvaluator {
  private readonly cache = new Map<string, ConditionExpression>();

  clearCache(): void {
    this.cache.clear();
  }

  parse(expression: string): ConditionExpression {
    const cached = this.cache.get(expression);
    if (cached) {
      this.cache.delete(expression);
      this.cache.set(expression, cached);
      return cached;
    }
    const parsed = parseCondition(expression);
    this.cache.set(expression, parsed);
    if (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    return parsed;
  }

  evaluate(expression: string, resolveVariable: RuntimeVariableResolver): boolean {
    return Boolean(evaluateConditionExpression(this.parse(expression), resolveVariable));
  }
}
