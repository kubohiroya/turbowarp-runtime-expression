import {
  collectRuntimeVariableNames,
  ConditionEvaluator,
  type ConditionExpression,
  evaluateConditionExpression
} from './condition.js';
import {
  readRuntimeVariableState,
  type RuntimeVariableState,
  requireRuntimeVariables
} from './runtime-variables.js';

export interface ConditionalBroadcastInput {
  id: string;
  condition: string;
  messageOnTrue: string;
  messageOnFalse: string;
  timeoutSeconds: number;
}

type RuntimeVariableSnapshot = Map<string, RuntimeVariableState>;

interface ConditionalBroadcastRegistration {
  expression: ConditionExpression;
  dependencies: string[];
  snapshot: RuntimeVariableSnapshot;
  result: boolean;
  messageOnTrue: string;
  messageOnFalse: string;
  expiresAt: number | null;
}

export class ConditionalBroadcastManager {
  private readonly registrations =
    new Map<string, ConditionalBroadcastRegistration>();

  constructor(
    private readonly runtime: TurboWarpRuntime,
    private readonly evaluator = new ConditionEvaluator(),
    private readonly now = (): number => performance.now()
  ) {}

  register(input: ConditionalBroadcastInput): void {
    const runtimeVariables = requireRuntimeVariables(this.runtime);
    const expression = this.evaluator.parse(input.condition);
    const dependencies = collectRuntimeVariableNames(expression);
    const snapshot = captureSnapshot(runtimeVariables, dependencies);
    const result = evaluateSnapshot(expression, snapshot);
    const expiresAt = input.timeoutSeconds > 0
      ? this.now() + input.timeoutSeconds * 1000
      : null;

    this.registrations.set(input.id, {
      expression,
      dependencies,
      snapshot,
      result,
      messageOnTrue: input.messageOnTrue,
      messageOnFalse: input.messageOnFalse,
      expiresAt
    });
  }

  unregister(id: string): void {
    this.registrations.delete(id);
  }

  clear(): void {
    this.registrations.clear();
  }

  processFrame(): void {
    if (this.registrations.size === 0) return;

    const now = this.now();
    for (const [id, registration] of this.registrations) {
      if (
        registration.expiresAt !== null
        && now >= registration.expiresAt
      ) {
        this.registrations.delete(id);
      }
    }
    if (this.registrations.size === 0) return;

    const runtimeVariables = requireRuntimeVariables(this.runtime);
    for (const registration of this.registrations.values()) {
      const snapshot = captureSnapshot(
        runtimeVariables,
        registration.dependencies
      );
      if (snapshotsEqual(registration.snapshot, snapshot)) continue;

      const result = evaluateSnapshot(registration.expression, snapshot);
      const previousResult = registration.result;
      registration.snapshot = snapshot;
      registration.result = result;

      if (result === previousResult) continue;
      const message = result
        ? registration.messageOnTrue
        : registration.messageOnFalse;
      this.runtime.startHats('event_whenbroadcastreceived', {
        BROADCAST_OPTION: message
      });
    }
  }
}

function captureSnapshot(
  extension: TemporaryVariablesExtension,
  dependencies: readonly string[]
): RuntimeVariableSnapshot {
  return new Map(
    dependencies.map((name) => [
      name,
      readRuntimeVariableState(extension, name)
    ])
  );
}

function evaluateSnapshot(
  expression: ConditionExpression,
  snapshot: RuntimeVariableSnapshot
): boolean {
  return Boolean(evaluateConditionExpression(
    expression,
    (name) => snapshot.get(name)?.value
  ));
}

function snapshotsEqual(
  left: RuntimeVariableSnapshot,
  right: RuntimeVariableSnapshot
): boolean {
  if (left.size !== right.size) return false;
  for (const [name, leftState] of left) {
    const rightState = right.get(name);
    if (
      !rightState
      || leftState.exists !== rightState.exists
      || !Object.is(leftState.value, rightState.value)
    ) {
      return false;
    }
  }
  return true;
}
