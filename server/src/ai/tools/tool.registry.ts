import type { AgentTool, ToolContext, ToolResult } from "./tool.types";
import type { AIToolDefinition } from "../providers/ai-provider.interface";
import { inventoryTools } from "./inventory.tools";

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();

  constructor(initial: AgentTool[] = []) {
    for (const tool of initial) this.register(tool);
  }

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  list(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  toAIToolDefinitions(): AIToolDefinition[] {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  async execute(
    name: string,
    context: ToolContext,
    input: Record<string, unknown>,
  ): Promise<ToolResult<unknown>> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, data: null, error: { code: "TOOL_NOT_FOUND", message: `Unknown tool: ${name}` }, metadata: { generatedAt: new Date().toISOString() } };
    }
    try {
      return await tool.execute(context, input);
    } catch (err) {
      return { success: false, data: null, error: { code: "TOOL_EXECUTION_ERROR", message: (err as Error).message }, metadata: { generatedAt: new Date().toISOString() } };
    }
  }
}

export const toolRegistry = new ToolRegistry(inventoryTools);