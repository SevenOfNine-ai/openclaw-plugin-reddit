export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  details?: unknown;
  isError?: boolean;
};

export type ToolDefinition = {
  name: string;
  label?: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (toolCallId: string, params: unknown) => Promise<ToolResult>;
};

export type PluginLogger = {
  debug?: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export type OpenClawPluginApi = {
  id: string;
  config: Record<string, unknown>;
  pluginConfig?: Record<string, unknown>;
  logger: PluginLogger;
  registerTool: (tool: ToolDefinition, opts?: { optional?: boolean }) => void;
  registerService: (service: {
    id: string;
    start: () => Promise<void> | void;
    stop?: () => Promise<void> | void;
  }) => void;
  registerGatewayMethod: (
    method: string,
    handler: (ctx: {
      params?: Record<string, unknown>;
      respond: (ok: boolean, payload?: unknown) => void;
    }) => Promise<void> | void,
  ) => void;
  registerCli?: (
    registrar: (ctx: { program: { command: (name: string) => any } }) => void,
    opts?: { commands?: string[] },
  ) => void;
};
