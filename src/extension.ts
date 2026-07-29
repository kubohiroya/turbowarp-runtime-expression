import definitions from './block-definitions.json' with {type: 'json'};
import {FEATURE_FLAGS} from '../config/feature-flags.js';
import {ConditionalBroadcastManager} from './conditional-broadcast.js';
import {ConditionEvaluator} from './condition.js';
import {readRuntimeVariable, requireRuntimeVariables} from './runtime-variables.js';

export const EXTENSION_ID = 'kubohiroyaruntimeexpression';
export const EXTENSION_VERSION = '2026-07-18-conditional-broadcast-v1';

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
  arguments: Record<string, DefinitionArgument>;
}

const blockDefinitions = definitions.blocks as DefinitionBlock[];

export class RuntimeExpressionExtension {
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
    return {
      id: EXTENSION_ID,
      name: Scratch.translate(definitions.extensionName),
      color1: '#6f5bd3',
      color2: '#5845b8',
      color3: '#40328e',
      blocks: blockDefinitions
        .filter((block) => !block.featureFlag || FEATURE_FLAGS[block.featureFlag])
        .map((block) => ({
          opcode: block.opcode,
          blockType: Scratch.BlockType[block.blockType],
          text: Scratch.translate(block.text),
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
  }

  runtimeCondition(args: BlockArgs): boolean {
    const runtimeVariables = requireRuntimeVariables(this.runtime);
    return this.evaluator.evaluate(
      String(args.EXPRESSION ?? ''),
      (name) => readRuntimeVariable(runtimeVariables, name)
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
