import { IExternalTool } from '../../models/external-tool'

export function getDefaultExternalTools(): ReadonlyArray<IExternalTool> {
  return [
    { id: 'meld', name: 'Meld', command: 'meld', args: '%L %R', builtIn: true },
    {
      id: 'kdiff3',
      name: 'KDiff3',
      command: 'kdiff3',
      args: '%L %R',
      builtIn: true,
    },
    {
      id: 'bcompare',
      name: 'Beyond Compare',
      command: 'bcompare',
      args: '%L %R',
      builtIn: true,
    },
    {
      id: 'code',
      name: 'VS Code',
      command: 'code',
      args: '--diff %L %R',
      builtIn: true,
    },
    {
      id: 'vimdiff',
      name: 'vimdiff',
      command: 'vimdiff',
      args: '%L %R',
      builtIn: true,
    },
  ]
}
