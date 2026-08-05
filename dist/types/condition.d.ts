export declare const MAX_EXPRESSION_LENGTH = 4096;
export declare const MAX_TOKEN_COUNT = 512;
export declare const MAX_PARSE_DEPTH = 64;
export declare const MAX_CACHE_ENTRIES = 128;
type Punctuation = '(' | ')' | '[' | ']';
type UnaryOperator = '!' | '+' | '-';
type BinaryOperator = '||' | '&&' | '==' | '!=' | '===' | '!==' | '<' | '<=' | '>' | '>=' | '+' | '-' | '*' | '/' | '%';
export type ConditionToken = {
    kind: 'number';
    value: number;
    position: number;
} | {
    kind: 'string';
    value: string;
    position: number;
} | {
    kind: 'identifier';
    value: string;
    position: number;
} | {
    kind: 'operator';
    value: UnaryOperator | BinaryOperator;
    position: number;
} | {
    kind: 'punctuation';
    value: Punctuation;
    position: number;
} | {
    kind: 'eof';
    position: number;
};
export type ConditionExpression = {
    kind: 'literal';
    value: unknown;
} | {
    kind: 'variable';
    name: string;
} | {
    kind: 'unary';
    operator: UnaryOperator;
    operand: ConditionExpression;
} | {
    kind: 'binary';
    operator: BinaryOperator;
    left: ConditionExpression;
    right: ConditionExpression;
};
export declare function collectRuntimeVariableNames(expression: ConditionExpression): string[];
export type RuntimeVariableResolver = (name: string) => unknown;
export declare class ConditionSyntaxError extends Error {
    readonly position: number;
    constructor(message: string, position: number);
}
export type ConditionSyntaxValidation = {
    ok: true;
} | {
    ok: false;
    code: 'CONDITION_SYNTAX_ERROR';
    position: number;
    message: string;
};
export declare function tokenizeCondition(expression: string): ConditionToken[];
export declare function parseCondition(expression: string): ConditionExpression;
export declare function validateConditionSyntax(expression: string): ConditionSyntaxValidation;
export declare function evaluateConditionExpression(expression: ConditionExpression, resolveVariable: RuntimeVariableResolver): unknown;
export declare class ConditionEvaluator {
    private readonly cache;
    clearCache(): void;
    parse(expression: string): ConditionExpression;
    evaluate(expression: string, resolveVariable: RuntimeVariableResolver): boolean;
}
export {};
