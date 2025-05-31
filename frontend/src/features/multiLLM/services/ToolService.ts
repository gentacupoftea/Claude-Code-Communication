import { Tool, ToolCall } from '../types';

export class ToolService {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  async executeTool(toolCall: ToolCall): Promise<any> {
    const tool = this.tools.get(toolCall.toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolCall.toolName}`);
    }

    try {
      const result = await tool.execute(toolCall.parameters);
      return { ...toolCall, result };
    } catch (error) {
      console.error(`Tool execution error (${toolCall.toolName}):`, error);
      throw error;
    }
  }

  private registerDefaultTools(): void {
    // データ取得ツール
    this.registerTool({
      name: 'fetch_data',
      description: 'APIやデータソースからデータを取得',
      parameters: {
        source: 'string',
        query: 'object'
      },
      execute: async (params) => {
        // 実装
        return { data: [] };
      }
    });

    // 計算ツール
    this.registerTool({
      name: 'calculate',
      description: '数値計算を実行',
      parameters: {
        expression: 'string',
        variables: 'object'
      },
      execute: async (params) => {
        // 実装
        return { result: 0 };
      }
    });

    // チャート生成ツール
    this.registerTool({
      name: 'create_chart',
      description: 'データからチャートを生成',
      parameters: {
        type: 'string',
        data: 'array',
        options: 'object'
      },
      execute: async (params) => {
        // 実装
        return {
          chartConfig: {
            type: params.type,
            data: params.data,
            options: params.options
          }
        };
      }
    });
  }

  getAvailableTools(): Tool[] {
    return Array.from(this.tools.values());
  }
}