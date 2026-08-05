const MAX_EXPRESSION_LENGTH = 4096;
const MAX_TOKEN_COUNT = 512;
const MAX_PARSE_DEPTH = 64;
const MAX_CACHE_ENTRIES = 128;
const MULTI_CHAR_OPERATORS = [
  "===",
  "!==",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||"
];
const SIMPLE_ESCAPES = {
  "\\": "\\",
  '"': '"',
  "'": "'",
  n: "\n",
  r: "\r",
  t: "	"
};
class ConditionSyntaxError extends Error {
  constructor(message, position) {
    super(`${message} at position ${position}.`);
    this.position = position;
    this.name = "ConditionSyntaxError";
  }
  position;
}
function tokenizeCondition(expression) {
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    throw new ConditionSyntaxError(
      `Expression exceeds the ${MAX_EXPRESSION_LENGTH} character limit`,
      MAX_EXPRESSION_LENGTH
    );
  }
  const tokens = [];
  let index = 0;
  const push = (token) => {
    tokens.push(token);
    if (tokens.length > MAX_TOKEN_COUNT) {
      throw new ConditionSyntaxError(
        `Expression exceeds the ${MAX_TOKEN_COUNT} token limit`,
        token.position
      );
    }
  };
  while (index < expression.length) {
    const character = expression[index];
    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }
    const position = index;
    const operator = MULTI_CHAR_OPERATORS.find(
      (candidate) => expression.startsWith(candidate, index)
    );
    if (operator) {
      push({ kind: "operator", value: operator, position });
      index += operator.length;
      continue;
    }
    if ("!+-*/%<>".includes(character)) {
      push({
        kind: "operator",
        value: character,
        position
      });
      index += 1;
      continue;
    }
    if ("()[]".includes(character)) {
      push({ kind: "punctuation", value: character, position });
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      const quote = character;
      let value = "";
      index += 1;
      let closed = false;
      while (index < expression.length) {
        const next = expression[index];
        if (next === quote) {
          closed = true;
          index += 1;
          break;
        }
        if (next === "\n" || next === "\r") {
          throw new ConditionSyntaxError("Unescaped newline in string literal", index);
        }
        if (next !== "\\") {
          value += next;
          index += 1;
          continue;
        }
        const escapePosition = index;
        index += 1;
        const escaped = expression[index];
        if (escaped === void 0) {
          throw new ConditionSyntaxError("Unterminated string escape", escapePosition);
        }
        if (escaped === "u") {
          const hexadecimal = expression.slice(index + 1, index + 5);
          if (!/^[0-9a-fA-F]{4}$/u.test(hexadecimal)) {
            throw new ConditionSyntaxError("Invalid Unicode escape", escapePosition);
          }
          value += String.fromCharCode(Number.parseInt(hexadecimal, 16));
          index += 5;
          continue;
        }
        const replacement = SIMPLE_ESCAPES[escaped];
        if (replacement === void 0) {
          throw new ConditionSyntaxError(`Unsupported string escape \\${escaped}`, escapePosition);
        }
        value += replacement;
        index += 1;
      }
      if (!closed) {
        throw new ConditionSyntaxError("Unterminated string literal", position);
      }
      push({ kind: "string", value, position });
      continue;
    }
    const rest = expression.slice(index);
    const numberMatch = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/u.exec(rest);
    if (numberMatch?.[0]) {
      const value = Number(numberMatch[0]);
      if (!Number.isFinite(value)) {
        throw new ConditionSyntaxError("Number literal must be finite", position);
      }
      push({ kind: "number", value, position });
      index += numberMatch[0].length;
      continue;
    }
    const identifierMatch = /^[A-Za-z_$][A-Za-z0-9_$]*/u.exec(rest);
    if (identifierMatch?.[0]) {
      push({ kind: "identifier", value: identifierMatch[0], position });
      index += identifierMatch[0].length;
      continue;
    }
    throw new ConditionSyntaxError(`Unexpected character ${JSON.stringify(character)}`, position);
  }
  push({ kind: "eof", position: expression.length });
  return tokens;
}
class ConditionParser {
  constructor(tokens) {
    this.tokens = tokens;
  }
  tokens;
  index = 0;
  depth = 0;
  parse() {
    if (this.current().kind === "eof") {
      throw new ConditionSyntaxError("Expression is empty", this.current().position);
    }
    const expression = this.parseLogicalOr();
    const trailing = this.current();
    if (trailing.kind !== "eof") {
      throw new ConditionSyntaxError("Unexpected trailing token", trailing.position);
    }
    return expression;
  }
  parseLogicalOr() {
    let expression = this.parseLogicalAnd();
    while (this.matchOperator("||")) {
      expression = {
        kind: "binary",
        operator: "||",
        left: expression,
        right: this.parseLogicalAnd()
      };
    }
    return expression;
  }
  parseLogicalAnd() {
    let expression = this.parseEquality();
    while (this.matchOperator("&&")) {
      expression = {
        kind: "binary",
        operator: "&&",
        left: expression,
        right: this.parseEquality()
      };
    }
    return expression;
  }
  parseEquality() {
    let expression = this.parseRelational();
    while (this.isOperator("==", "!=", "===", "!==")) {
      const operator = this.advanceOperator();
      expression = {
        kind: "binary",
        operator,
        left: expression,
        right: this.parseRelational()
      };
    }
    return expression;
  }
  parseRelational() {
    let expression = this.parseAdditive();
    while (this.isOperator("<", "<=", ">", ">=")) {
      const operator = this.advanceOperator();
      expression = {
        kind: "binary",
        operator,
        left: expression,
        right: this.parseAdditive()
      };
    }
    return expression;
  }
  parseAdditive() {
    let expression = this.parseMultiplicative();
    while (this.isOperator("+", "-")) {
      const operator = this.advanceOperator();
      expression = {
        kind: "binary",
        operator,
        left: expression,
        right: this.parseMultiplicative()
      };
    }
    return expression;
  }
  parseMultiplicative() {
    let expression = this.parseUnary();
    while (this.isOperator("*", "/", "%")) {
      const operator = this.advanceOperator();
      expression = {
        kind: "binary",
        operator,
        left: expression,
        right: this.parseUnary()
      };
    }
    return expression;
  }
  parseUnary() {
    if (this.isOperator("!", "+", "-")) {
      const token = this.current();
      const operator = this.advanceOperator();
      return this.withDepth(token.position, () => ({
        kind: "unary",
        operator,
        operand: this.parseUnary()
      }));
    }
    return this.parsePrimary();
  }
  parsePrimary() {
    const token = this.current();
    if (token.kind === "number" || token.kind === "string") {
      this.index += 1;
      return { kind: "literal", value: token.value };
    }
    if (token.kind === "identifier") {
      this.index += 1;
      if (token.value === "true") return { kind: "literal", value: true };
      if (token.value === "false") return { kind: "literal", value: false };
      if (token.value === "null") return { kind: "literal", value: null };
      if (token.value === "undefined") return { kind: "literal", value: void 0 };
      if (token.value === "vars" && this.matchPunctuation("[")) {
        const nameToken = this.current();
        if (nameToken.kind !== "string") {
          throw new ConditionSyntaxError(
            "vars[...] requires a string literal variable name",
            nameToken.position
          );
        }
        this.index += 1;
        this.expectPunctuation("]");
        return { kind: "variable", name: nameToken.value };
      }
      return { kind: "variable", name: token.value };
    }
    if (this.matchPunctuation("(")) {
      return this.withDepth(token.position, () => {
        const expression = this.parseLogicalOr();
        this.expectPunctuation(")");
        return expression;
      });
    }
    throw new ConditionSyntaxError("Expected a literal, variable, or parenthesized expression", token.position);
  }
  withDepth(position, action) {
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
  current() {
    return this.tokens[this.index] ?? { kind: "eof", position: 0 };
  }
  isOperator(...operators) {
    const token = this.current();
    return token.kind === "operator" && operators.includes(token.value);
  }
  matchOperator(operator) {
    if (!this.isOperator(operator)) return false;
    this.index += 1;
    return true;
  }
  advanceOperator() {
    const token = this.current();
    if (token.kind !== "operator") {
      throw new ConditionSyntaxError("Expected an operator", token.position);
    }
    this.index += 1;
    return token.value;
  }
  matchPunctuation(punctuation) {
    const token = this.current();
    if (token.kind !== "punctuation" || token.value !== punctuation) return false;
    this.index += 1;
    return true;
  }
  expectPunctuation(punctuation) {
    const token = this.current();
    if (token.kind !== "punctuation" || token.value !== punctuation) {
      throw new ConditionSyntaxError(`Expected ${punctuation}`, token.position);
    }
    this.index += 1;
  }
}
function parseCondition(expression) {
  return new ConditionParser(tokenizeCondition(expression)).parse();
}
function validateConditionSyntax(expression) {
  try {
    parseCondition(expression);
    return { ok: true };
  } catch (error) {
    if (!(error instanceof ConditionSyntaxError)) throw error;
    return {
      ok: false,
      code: "CONDITION_SYNTAX_ERROR",
      position: error.position,
      message: error.message
    };
  }
}
function evaluateConditionExpression(expression, resolveVariable) {
  switch (expression.kind) {
    case "literal":
      return expression.value;
    case "variable":
      return resolveVariable(expression.name);
    case "unary": {
      const value = evaluateConditionExpression(expression.operand, resolveVariable);
      if (expression.operator === "!") return !value;
      if (expression.operator === "+") return Number(value);
      return -Number(value);
    }
    case "binary": {
      const left = evaluateConditionExpression(expression.left, resolveVariable);
      if (expression.operator === "&&") {
        return left && evaluateConditionExpression(expression.right, resolveVariable);
      }
      if (expression.operator === "||") {
        return left || evaluateConditionExpression(expression.right, resolveVariable);
      }
      const right = evaluateConditionExpression(expression.right, resolveVariable);
      switch (expression.operator) {
        case "==":
          return left == right;
        case "!=":
          return left != right;
        case "===":
          return left === right;
        case "!==":
          return left !== right;
        case "<":
          return left < right;
        case "<=":
          return left <= right;
        case ">":
          return left > right;
        case ">=":
          return left >= right;
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          return left / right;
        case "%":
          return left % right;
      }
    }
  }
}
class ConditionEvaluator {
  cache = /* @__PURE__ */ new Map();
  clearCache() {
    this.cache.clear();
  }
  parse(expression) {
    const cached = this.cache.get(expression);
    if (cached) {
      this.cache.delete(expression);
      this.cache.set(expression, cached);
      return cached;
    }
    const parsed = parseCondition(expression);
    this.cache.set(expression, parsed);
    if (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== void 0) this.cache.delete(oldest);
    }
    return parsed;
  }
  evaluate(expression, resolveVariable) {
    return Boolean(evaluateConditionExpression(this.parse(expression), resolveVariable));
  }
}
class RuntimeExpressionCompositionError extends Error {
  constructor(code, message, variableName) {
    super(message);
    this.code = code;
    this.variableName = variableName;
    this.name = "RuntimeExpressionCompositionError";
  }
  code;
  variableName;
}
function invalidVariableProperty(variableName, reason) {
  return new RuntimeExpressionCompositionError(
    "RUNTIME_EXPRESSION_INVALID_VARIABLE_PROPERTY",
    `Runtime variable ${JSON.stringify(variableName)} ${reason}.`,
    variableName
  );
}
function snapshotVariables(variables) {
  if (variables === null || typeof variables !== "object") {
    throw new RuntimeExpressionCompositionError(
      "RUNTIME_EXPRESSION_INVALID_VARIABLE_MAP",
      "Runtime variables must be a plain object."
    );
  }
  let prototype;
  let descriptors;
  let symbols;
  try {
    prototype = Object.getPrototypeOf(variables);
    descriptors = Object.getOwnPropertyDescriptors(variables);
    symbols = Object.getOwnPropertySymbols(variables);
  } catch {
    throw new RuntimeExpressionCompositionError(
      "RUNTIME_EXPRESSION_INVALID_VARIABLE_MAP",
      "Runtime variables must be an inspectable plain object."
    );
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RuntimeExpressionCompositionError(
      "RUNTIME_EXPRESSION_INVALID_VARIABLE_MAP",
      "Runtime variables must be a plain object."
    );
  }
  if (symbols.length > 0) {
    throw new RuntimeExpressionCompositionError(
      "RUNTIME_EXPRESSION_INVALID_VARIABLE_PROPERTY",
      "Runtime variable names must be strings."
    );
  }
  const snapshot = /* @__PURE__ */ Object.create(null);
  for (const [name, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable) {
      throw invalidVariableProperty(name, "must be enumerable");
    }
    if (!("value" in descriptor)) {
      throw invalidVariableProperty(name, "must be a data property");
    }
    const value = descriptor.value;
    if (typeof value !== "string" && typeof value !== "boolean" && typeof value !== "number" || typeof value === "number" && !Number.isFinite(value)) {
      throw new RuntimeExpressionCompositionError(
        "RUNTIME_EXPRESSION_INVALID_VARIABLE_VALUE",
        `Runtime variable ${JSON.stringify(name)} must be a string, finite number, or boolean.`,
        name
      );
    }
    snapshot[name] = value;
  }
  return Object.freeze(snapshot);
}
function createRuntimeExpressionComposition() {
  const evaluator = new ConditionEvaluator();
  const composition = {
    validateConditionSyntax,
    evaluateCondition(expression, variables) {
      const snapshot = snapshotVariables(variables);
      return evaluator.evaluate(expression, (name) => {
        if (!Object.hasOwn(snapshot, name)) {
          throw new RuntimeExpressionCompositionError(
            "RUNTIME_EXPRESSION_UNKNOWN_VARIABLE",
            `Runtime variable ${JSON.stringify(name)} is not defined.`,
            name
          );
        }
        return snapshot[name];
      });
    },
    releaseAll() {
      evaluator.clearCache();
    }
  };
  return Object.freeze(composition);
}
export {
  RuntimeExpressionCompositionError,
  createRuntimeExpressionComposition
};
