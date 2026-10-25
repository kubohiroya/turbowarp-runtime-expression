import {registerFixedInputEditors} from './fixed-input-editors.js';
import definitions from './block-definitions.json' with {type: 'json'};
import {FEATURE_FLAGS} from '../config/feature-flags.js';
import {ConditionalBroadcastManager} from './conditional-broadcast.js';
import {
  ConditionEvaluator,
  validateConditionSyntax as validateConditionSyntaxResult
} from './condition.js';
import {readRuntimeVariable, requireRuntimeVariables} from './runtime-variables.js';

export const EXTENSION_ID = 'kubohiroyaruntimeexpression';
export const EXTENSION_VERSION = '0.6.1';
export const DOCS_URI =
  'https://kubohiroya.github.io/turbowarp-runtime-expression/';
export const BLOCK_ICON_URI = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M6 36h13V14h23" fill="none" stroke="#E6533C" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="19" cy="25" r="5" fill="#FFAB19"/></svg>'
)}`;

type BlockArgs = Record<string, unknown>;

interface DefinitionArgument {
  type: keyof typeof Scratch.ArgumentType;
  defaultValue: unknown;
}

interface DefinitionBlock {
  opcode: string;
  blockType: keyof typeof Scratch.BlockType;
  text: string;
  description: string;
  featureFlag?: keyof typeof FEATURE_FLAGS;
  hideFromPalette?: boolean;
  arguments: Record<string, DefinitionArgument>;
}

const blockDefinitions = definitions.blocks as DefinitionBlock[];

export class RuntimeExpressionExtension {
  private fixedEditorsDispose: (() => void) | undefined;

  private readonly runtime = Scratch.vm.runtime;
  private readonly evaluator = new ConditionEvaluator();
  private readonly conditionalBroadcasts =
    new ConditionalBroadcastManager(this.runtime, this.evaluator);

  constructor() {
    this.runtime.on(
      'BEFORE_EXECUTE',
      () => this.conditionalBroadcasts.processFrame()
    );
    const clearConditionalBroadcasts =
      (): void => this.conditionalBroadcasts.clear();
    this.runtime.on('PROJECT_START', clearConditionalBroadcasts);
    this.runtime.on('PROJECT_STOP_ALL', clearConditionalBroadcasts);
  }

  getInfo(): ScratchExtensionInfo {
    const info = {
      id: EXTENSION_ID,
      name: Scratch.translate(definitions.extensionName),
      docsURI: DOCS_URI,
      blockIconURI: BLOCK_ICON_URI,
      color1: '#6f5bd3',
      color2: '#5845b8',
      color3: '#40328e',
      blocks: blockDefinitions
        .filter((block) => !block.featureFlag || FEATURE_FLAGS[block.featureFlag])
        .map((block) => ({
          opcode: block.opcode,
          blockType: Scratch.BlockType[block.blockType],
          text: Scratch.translate(block.text),
          ...(block.hideFromPalette ? {hideFromPalette: true} : {}),
          arguments: Object.fromEntries(
            Object.entries(block.arguments).map(([name, argument]) => [
              name,
              {
                type: Scratch.ArgumentType[argument.type],
                defaultValue: argument.defaultValue
              }
            ])
          )
        }))
    };
    this.fixedEditorsDispose ??= registerFixedInputEditors(Scratch, this.runtime, info.blocks);
    return info;
  }

  runtimeCondition(args: BlockArgs): boolean {
    const runtimeVariables = requireRuntimeVariables(this.runtime);
    return this.evaluator.evaluate(
      String(args.EXPRESSION ?? ''),
      (name) => readRuntimeVariable(runtimeVariables, name)
    );
  }

  validateConditionSyntax(args: BlockArgs): string {
    return JSON.stringify(
      validateConditionSyntaxResult(String(args.EXPRESSION ?? ''))
    );
  }

  registerConditionalBroadcast(args: BlockArgs): void {
    this.conditionalBroadcasts.register({
      id: String(args.ID ?? ''),
      condition: String(args.CONDITION ?? ''),
      messageOnTrue: String(args.MESSAGE_ON_TRUE ?? ''),
      messageOnFalse: String(args.MESSAGE_ON_FALSE ?? ''),
      timeoutSeconds: Number(args.TIMEOUT ?? 0)
    });
  }

  unregisterConditionalBroadcast(args: BlockArgs): void {
    this.conditionalBroadcasts.unregister(String(args.ID ?? ''));
  }
}
