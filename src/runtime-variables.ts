export function getRuntimeVariablesIfAvailable(
  runtime: Pick<TurboWarpRuntime, 'ext_lmsTempVars2'>
): TemporaryVariablesExtension | undefined {
  const extension = runtime.ext_lmsTempVars2;
  if (
    !extension
    || typeof extension.setRuntimeVariable !== 'function'
    || typeof extension.getRuntimeVariable !== 'function'
    || typeof extension.runtimeVariableExists !== 'function'
  ) {
    return undefined;
  }
  return extension;
}

export function requireRuntimeVariables(
  runtime: Pick<TurboWarpRuntime, 'ext_lmsTempVars2'>
): TemporaryVariablesExtension {
  const extension = getRuntimeVariablesIfAvailable(runtime);
  if (extension) return extension;
  throw new Error(
    'Temporary Variables (lmsTempVars2) must be loaded before using Runtime Expression.'
  );
}

export interface RuntimeVariableState {
  exists: boolean;
  value: unknown;
}

export function readRuntimeVariableState(
  extension: TemporaryVariablesExtension,
  name: string
): RuntimeVariableState {
  const exists = extension.runtimeVariableExists({VAR: name});
  return {
    exists,
    value: exists ? extension.getRuntimeVariable({VAR: name}) : undefined
  };
}

export function readRuntimeVariable(
  extension: TemporaryVariablesExtension,
  name: string
): unknown {
  return readRuntimeVariableState(extension, name).value;
}
