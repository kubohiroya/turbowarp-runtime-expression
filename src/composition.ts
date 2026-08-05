import {
  ConditionEvaluator,
  type ConditionSyntaxValidation,
  validateConditionSyntax
} from './condition.js';

export type RuntimeExpressionVariableValue = string | number | boolean;
export type RuntimeExpressionVariables = Readonly<
  Record<string, RuntimeExpressionVariableValue>
>;

export type RuntimeExpressionCompositionErrorCode =
  | 'RUNTIME_EXPRESSION_INVALID_VARIABLE_MAP'
  | 'RUNTIME_EXPRESSION_INVALID_VARIABLE_PROPERTY'
  | 'RUNTIME_EXPRESSION_INVALID_VARIABLE_VALUE'
  | 'RUNTIME_EXPRESSION_UNKNOWN_VARIABLE';

export class RuntimeExpressionCompositionError extends Error {
  constructor(
    readonly code: RuntimeExpressionCompositionErrorCode,
    message: string,
    readonly variableName?: string
  ) {
    super(message);
    this.name = 'RuntimeExpressionCompositionError';
  }
}

export interface RuntimeExpressionComposition {
  validateConditionSyntax(expression: string): ConditionSyntaxValidation;
  evaluateCondition(
    expression: string,
    variables: RuntimeExpressionVariables
  ): boolean;
  releaseAll(): void;
}

function invalidVariableProperty(
  variableName: string,
  reason: string
): RuntimeExpressionCompositionError {
  return new RuntimeExpressionCompositionError(
    'RUNTIME_EXPRESSION_INVALID_VARIABLE_PROPERTY',
    `Runtime variable ${JSON.stringify(variableName)} ${reason}.`,
    variableName
  );
}

function snapshotVariables(
  variables: RuntimeExpressionVariables
): Readonly<Record<string, RuntimeExpressionVariableValue>> {
  if (variables === null || typeof variables !== 'object') {
    throw new RuntimeExpressionCompositionError(
      'RUNTIME_EXPRESSION_INVALID_VARIABLE_MAP',
      'Runtime variables must be a plain object.'
    );
  }

  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  let symbols: symbol[];
  try {
    prototype = Object.getPrototypeOf(variables) as object | null;
    descriptors = Object.getOwnPropertyDescriptors(variables);
    symbols = Object.getOwnPropertySymbols(variables);
  } catch {
    throw new RuntimeExpressionCompositionError(
      'RUNTIME_EXPRESSION_INVALID_VARIABLE_MAP',
      'Runtime variables must be an inspectable plain object.'
    );
  }

  if (prototype !== Object.prototype && prototype !== null) {
    throw new RuntimeExpressionCompositionError(
      'RUNTIME_EXPRESSION_INVALID_VARIABLE_MAP',
      'Runtime variables must be a plain object.'
    );
  }
  if (symbols.length > 0) {
    throw new RuntimeExpressionCompositionError(
      'RUNTIME_EXPRESSION_INVALID_VARIABLE_PROPERTY',
      'Runtime variable names must be strings.'
    );
  }

  const snapshot = Object.create(null) as Record<
    string,
    RuntimeExpressionVariableValue
  >;
  for (const [name, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable) {
      throw invalidVariableProperty(name, 'must be enumerable');
    }
    if (!('value' in descriptor)) {
      throw invalidVariableProperty(name, 'must be a data property');
    }
    const value = descriptor.value as unknown;
    if (
      (typeof value !== 'string' &&
        typeof value !== 'boolean' &&
        typeof value !== 'number') ||
      (typeof value === 'number' && !Number.isFinite(value))
    ) {
      throw new RuntimeExpressionCompositionError(
        'RUNTIME_EXPRESSION_INVALID_VARIABLE_VALUE',
        `Runtime variable ${JSON.stringify(name)} must be a string, finite number, or boolean.`,
        name
      );
    }
    snapshot[name] = value;
  }
  return Object.freeze(snapshot);
}

export function createRuntimeExpressionComposition(): RuntimeExpressionComposition {
  const evaluator = new ConditionEvaluator();

  const composition: RuntimeExpressionComposition = {
    validateConditionSyntax,
    evaluateCondition(expression, variables) {
      const snapshot = snapshotVariables(variables);
      return evaluator.evaluate(expression, (name) => {
        if (!Object.hasOwn(snapshot, name)) {
          throw new RuntimeExpressionCompositionError(
            'RUNTIME_EXPRESSION_UNKNOWN_VARIABLE',
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
