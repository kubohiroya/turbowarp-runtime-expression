import { type ConditionSyntaxValidation } from './condition.js';
export type RuntimeExpressionVariableValue = string | number | boolean;
export type RuntimeExpressionVariables = Readonly<Record<string, RuntimeExpressionVariableValue>>;
export type RuntimeExpressionCompositionErrorCode = 'RUNTIME_EXPRESSION_INVALID_VARIABLE_MAP' | 'RUNTIME_EXPRESSION_INVALID_VARIABLE_PROPERTY' | 'RUNTIME_EXPRESSION_INVALID_VARIABLE_VALUE' | 'RUNTIME_EXPRESSION_UNKNOWN_VARIABLE';
export declare class RuntimeExpressionCompositionError extends Error {
    readonly code: RuntimeExpressionCompositionErrorCode;
    readonly variableName?: string | undefined;
    constructor(code: RuntimeExpressionCompositionErrorCode, message: string, variableName?: string | undefined);
}
export interface RuntimeExpressionComposition {
    validateConditionSyntax(expression: string): ConditionSyntaxValidation;
    evaluateCondition(expression: string, variables: RuntimeExpressionVariables): boolean;
    releaseAll(): void;
}
export declare function createRuntimeExpressionComposition(): RuntimeExpressionComposition;
