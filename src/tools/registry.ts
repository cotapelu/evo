// Tool Registry - manages custom evo tools
// Currently tools are defined in evoTools.ts and passed to createAgentSession directly

export class ToolRegistry {
  private tools: Array<{ name: string; definition: any }> = [];

  register(name: string, definition: any) {
    this.tools.push({ name, definition });
  }

  getAll() {
    return this.tools.map(t => t.definition);
  }

  get(name: string) {
    return this.tools.find(t => t.name === name)?.definition;
  }
}
