import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "mock-reddit-server",
    version: "0.0.1",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_top_posts",
        description: "Mock read tool",
        inputSchema: {
          type: "object",
          properties: {
            subreddit: { type: "string" },
          },
        },
      },
      {
        name: "create_post",
        description: "Mock write tool",
        inputSchema: {
          type: "object",
          required: ["subreddit", "title", "content"],
          properties: {
            subreddit: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "get_top_posts") {
    return {
      content: [
        {
          type: "text",
          text: `mock-read:${JSON.stringify(args ?? {})}`,
        },
      ],
      isError: false,
    };
  }

  if (name === "create_post") {
    return {
      content: [
        {
          type: "text",
          text: `mock-write:${JSON.stringify(args ?? {})}`,
        },
      ],
      isError: false,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `unknown:${name}`,
      },
    ],
    isError: true,
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
