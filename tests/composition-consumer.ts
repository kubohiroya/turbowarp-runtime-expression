import {
  createRuntimeExpressionComposition,
  RuntimeExpressionCompositionError,
  type RuntimeExpressionComposition,
  type RuntimeExpressionVariables
} from '@kubohiroya/turbowarp-runtime-expression/composition';

const variables: RuntimeExpressionVariables = {state: 'ready', score: 10};
const composition: RuntimeExpressionComposition =
  createRuntimeExpressionComposition();
const valid: boolean = composition.evaluateCondition(
  'state == "ready" && score >= 10',
  variables
);
const validation = composition.validateConditionSyntax('state === "ready"');
const error: RuntimeExpressionCompositionError | undefined = undefined;

void valid;
void validation;
void error;
composition.releaseAll();
