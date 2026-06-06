import { IExternalTool } from '../../models/external-tool'

export interface ISubstituteArgsInput {
  readonly leftPath: string
  readonly rightPath: string
  readonly basePath?: string
}

export function substituteArgs(
  tool: IExternalTool,
  input: ISubstituteArgsInput
): ReadonlyArray<string> {
  const tokens = tokenize(tool.args)
  const result: string[] = [tool.command]

  for (const token of tokens) {
    if (token === '%L') {
      result.push(input.leftPath)
    } else if (token === '%R') {
      result.push(input.rightPath)
    } else if (token === '%B') {
      if (input.basePath === undefined) {
        throw new Error(
          `Tool "${tool.name}" requires basePath (%B) but basePath is required.`
        )
      }
      result.push(input.basePath)
    } else {
      result.push(token)
    }
  }

  return result
}

function tokenize(args: string): string[] {
  // Simple whitespace split. If we need quoted-arg support later, swap
  // for a proper shell-quote tokenizer. For now all default tools use
  // simple "%L %R" patterns.
  return args.split(/\s+/).filter(t => t.length > 0)
}