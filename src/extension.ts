import definitions from './block-definitions.json' with {type: 'json'};
import {FEATURE_FLAGS} from '../config/feature-flags.js';
import {ConditionEvaluator} from './condition.js';
import {readRuntimeVariable, requireRuntimeVariables} from './runtime-variables.js';

export const EXTENSION_ID = 'twRuntimeExpression';
export const EXTENSION_VERSION = '2026-07-18-runtime-expression-v1';

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
}
