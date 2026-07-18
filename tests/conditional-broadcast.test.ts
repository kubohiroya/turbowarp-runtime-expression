import {describe, expect, it, vi} from 'vitest';
import {ConditionalBroadcastManager} from '../src/conditional-broadcast.js';
import {ConditionEvaluator} from '../src/condition.js';

interface Harness {
  manager: ConditionalBroadcastManager;
  values: Map<string, unknown>;
  startHats: ReturnType<typeof vi.fn>;
  setTime(value: number): void;
}

function createHarness(
  initialValues: Iterable<readonly [string, unknown]> = []
): Harness {
  const values = new Map(initialValues);
  const startHats = vi.fn(() => []);
  let now = 0;
  const runtime: TurboWarpRuntime = {
    ext_lmsTempVars2: {
      setRuntimeVariable: vi.fn(),
      getRuntimeVariable: ({VAR}: {VAR: string}) => values.get(VAR),
      runtimeVariableExists: ({VAR}: {VAR: string}) => values.has(VAR)
    },
    on: vi.fn(),
    startHats
  };
  return {
    manager: new ConditionalBroadcastManager(
      runtime,
      new ConditionEvaluator(),
      () => now
    ),
    values,
    startHats,
    setTime: (value) => {
      now = value;
    }
  };
}

function registerFlag(
  manager: ConditionalBroadcastManager,
  overrides: Partial<Parameters<ConditionalBroadcastManager['register']>[0]> = {}
): void {
  manager.register({
    id: 'watcher',
    condition: 'flag',
    messageOnTrue: 'flag on',
    messageOnFalse: 'flag off',
    timeoutSeconds: 0,
    ...overrides
  });
}

describe('conditional broadcast manager', () => {
  it('uses the initial result as a silent baseline and broadcasts boolean edges', () => {
    const harness = createHarness([['flag', false]]);
    registerFlag(harness.manager);

    expect(harness.startHats).not.toHaveBeenCalled();
    harness.manager.processFrame();
    expect(harness.startHats).not.toHaveBeenCalled();

    harness.values.set('flag', true);
    harness.manager.processFrame();
    expect(harness.startHats).toHaveBeenLastCalledWith(
      'event_whenbroadcastreceived',
      {BROADCAST_OPTION: 'flag on'}
    );

    harness.manager.processFrame();
    expect(harness.startHats).toHaveBeenCalledTimes(1);

    harness.values.set('flag', false);
    harness.manager.processFrame();
    expect(harness.startHats).toHaveBeenLastCalledWith(
      'event_whenbroadcastreceived',
      {BROADCAST_OPTION: 'flag off'}
    );
    expect(harness.startHats).toHaveBeenCalledTimes(2);
  });

  it('does not broadcast for unrelated changes or unchanged boolean results', () => {
    const harness = createHarness([['count', 1], ['unrelated', 'a']]);
    harness.manager.register({
      id: 'positive',
      condition: 'count > 0',
      messageOnTrue: 'positive',
      messageOnFalse: 'not positive',
      timeoutSeconds: 0
    });

    harness.values.set('unrelated', 'b');
    harness.manager.processFrame();
    harness.values.set('count', 2);
    harness.manager.processFrame();
    expect(harness.startHats).not.toHaveBeenCalled();

    harness.values.set('count', -1);
    harness.manager.processFrame();
    expect(harness.startHats).toHaveBeenCalledOnce();
    expect(harness.startHats).toHaveBeenCalledWith(
      'event_whenbroadcastreceived',
      {BROADCAST_OPTION: 'not positive'}
    );
  });

  it('detects creation and deletion of a runtime variable', () => {
    const harness = createHarness();
    harness.manager.register({
      id: 'exists',
      condition: 'missing !== undefined',
      messageOnTrue: 'created',
      messageOnFalse: 'deleted',
      timeoutSeconds: 0
    });

    harness.values.set('missing', '');
    harness.manager.processFrame();
    expect(harness.startHats).toHaveBeenLastCalledWith(
      'event_whenbroadcastreceived',
      {BROADCAST_OPTION: 'created'}
    );

    harness.values.delete('missing');
    harness.manager.processFrame();
    expect(harness.startHats).toHaveBeenLastCalledWith(
      'event_whenbroadcastreceived',
      {BROADCAST_OPTION: 'deleted'}
    );
  });

  it('uses Object.is semantics when comparing runtime variable values', () => {
    const harness = createHarness([['value', -0]]);
    harness.manager.register({
      id: 'signed-zero',
      condition: '1 / value > 0',
      messageOnTrue: 'positive zero',
      messageOnFalse: 'negative zero',
      timeoutSeconds: 0
    });

    harness.values.set('value', 0);
    harness.manager.processFrame();
    expect(harness.startHats).toHaveBeenCalledWith(
      'event_whenbroadcastreceived',
      {BROADCAST_OPTION: 'positive zero'}
    );
  });

  it('keeps the previous registration when an atomic replacement fails', () => {
    const harness = createHarness([['flag', false]]);
    registerFlag(harness.manager);

    expect(() => registerFlag(harness.manager, {condition: 'flag = true'}))
      .toThrow();

    harness.values.set('flag', true);
    harness.manager.processFrame();
    expect(harness.startHats).toHaveBeenCalledWith(
      'event_whenbroadcastreceived',
      {BROADCAST_OPTION: 'flag on'}
    );
  });

  it('replaces and unregisters registrations by ID', () => {
    const harness = createHarness([['flag', false], ['other', false]]);
    registerFlag(harness.manager);
    registerFlag(harness.manager, {
      condition: 'other',
      messageOnTrue: 'other on',
      messageOnFalse: 'other off'
    });

    harness.values.set('flag', true);
    harness.manager.processFrame();
    expect(harness.startHats).not.toHaveBeenCalled();

    harness.values.set('other', true);
    harness.manager.processFrame();
    expect(harness.startHats).toHaveBeenCalledWith(
      'event_whenbroadcastreceived',
      {BROADCAST_OPTION: 'other on'}
    );

    harness.manager.unregister('missing');
    harness.manager.unregister('watcher');
    harness.values.set('other', false);
    harness.manager.processFrame();
    expect(harness.startHats).toHaveBeenCalledTimes(1);
  });

  it('expires positive timeouts silently and keeps non-positive timeouts', () => {
    const expiring = createHarness([['flag', false]]);
    registerFlag(expiring.manager, {timeoutSeconds: 1});
    expiring.values.set('flag', true);
    expiring.setTime(1000);
    expiring.manager.processFrame();
    expect(expiring.startHats).not.toHaveBeenCalled();

    for (const timeoutSeconds of [0, -1]) {
      const persistent = createHarness([['flag', false]]);
      registerFlag(persistent.manager, {timeoutSeconds});
      persistent.values.set('flag', true);
      persistent.setTime(1_000_000);
      persistent.manager.processFrame();
      expect(persistent.startHats).toHaveBeenCalledOnce();
    }
  });

  it('coalesces multiple changes before a frame into the final state', () => {
    const harness = createHarness([['flag', false]]);
    registerFlag(harness.manager);

    harness.values.set('flag', true);
    harness.values.set('flag', false);
    harness.manager.processFrame();
    expect(harness.startHats).not.toHaveBeenCalled();

    harness.values.set('flag', true);
    harness.manager.processFrame();
    expect(harness.startHats).toHaveBeenCalledOnce();
  });
});
