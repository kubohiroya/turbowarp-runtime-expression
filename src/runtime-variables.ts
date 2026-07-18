export function requireRuntimeVariables(
  runtime: Pick<TurboWarpRuntime, 'ext_lmsTempVars2'>
): TemporaryVariablesExtension {
  const extension = runtime.ext_lmsTempVars2;
  if (
    !extension
    || typeof extension.setRuntimeVariable !== 'function'
    || typeof extension.getRuntimeVariable !== 'function'
    || typeof extension.runtimeVariableExists !== 'function'
  ) {
    throw new Error(
      'Temporary Variables (lmsTempVars2) must be loaded before using Runtime Expression.'
    );
  }
  return extension;
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
