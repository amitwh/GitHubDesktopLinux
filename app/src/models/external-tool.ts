export interface IExternalTool {
  readonly id: string
  readonly name: string
  readonly command: string                  // Absolute path or command in PATH
  readonly args: string                     // Template with %L %R %B placeholders
  readonly builtIn: boolean                  // True for default tools (cannot be deleted, can be overridden)
}
