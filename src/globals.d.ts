interface TemporaryVariablesExtension {
  setRuntimeVariable(args: {VAR: string; STRING: unknown}): void;
  getRuntimeVariable(args: {VAR: string}): unknown;
  runtimeVariableExists(args: {VAR: string}): boolean;
}

interface TurboWarpRuntime {
  ext_lmsTempVars2?: TemporaryVariablesExtension;
  on(event: string, listener: () => void): void;
  startHats(
    opcode: string,
    matchFields?: Record<string, string>
  ): unknown[] | undefined;
}

interface ScratchBlockDefinition {
  opcode: string;
  blockType: string;
  text: string;
  arguments: Record<string, {type: string; defaultValue: unknown}>;
}

interface ScratchExtensionInfo {
  id: string;
  name: string;
  docsURI: string;
  color1: string;
  color2: string;
  color3: string;
  blocks: ScratchBlockDefinition[];
}

interface ScratchTranslate {
  (text: string): string;
}

declare const Scratch: {
  vm: {runtime: TurboWarpRuntime};
  extensions: {
    unsandboxed: boolean;
    register(extension: unknown): void;
  };
  BlockType: {
    COMMAND: string;
    BOOLEAN: string;
    REPORTER: string;
  };
  ArgumentType: {
    NUMBER: string;
    STRING: string;
  };
  translate: ScratchTranslate;
};
