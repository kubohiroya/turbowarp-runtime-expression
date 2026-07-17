export function requireRuntimeVariables(
  runtime: TurboWarpRuntime
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

export function readRuntimeVariable(
  extension: TemporaryVariablesExtension,
  name: string
): unknown {
  return extension.runtimeVariableExists({VAR: name})
    ? extension.getRuntimeVariable({VAR: name})
    : undefined;
}
