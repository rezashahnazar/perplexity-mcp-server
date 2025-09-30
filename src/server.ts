#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import { PerplexityChatParams, PerplexityChatResponse } from "./types.js";

// Load environment variables
dotenv.config();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_BASE = "https://api.perplexity.ai";

if (!PERPLEXITY_API_KEY) {
  console.error("PERPLEXITY_API_KEY environment variable is required");
  process.exit(1);
}

class PerplexityMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "perplexity-search-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "perplexity_search_chat",
            description:
              "Ask questions and get AI-powered answers with real-time web search from Perplexity AI. Use this when you need current information, facts, research, news, or any query that benefits from up-to-date web sources. Responses include citations to original sources. Best for: current events, research questions, factual queries, technical documentation lookups, and any information that requires recent or authoritative web sources.",
            inputSchema: {
              type: "object",
              properties: {
                content: {
                  type: "string",
                  description:
                    "The user message/query to send to Perplexity AI",
                },
              },
              required: ["content"],
            },
          },
        ],
      };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === "perplexity_search_chat") {
          return await this.handlePerplexityChat(args);
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing ${name}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handlePerplexityChat(args: any): Promise<CallToolResult> {
    const chatParams: PerplexityChatParams = {
      model: "sonar-pro",
      messages: [
        {
          role: "user",
          content: args.content,
        },
      ],
      return_citations: true,
    };

    const response = await this.callChatAPI(chatParams);

    const content =
      response.choices[0]?.message?.content || "No response generated";

    return {
      content: [
        {
          type: "text",
          text: content,
        },
      ],
    };
  }

  private async callChatAPI(
    params: PerplexityChatParams
  ): Promise<PerplexityChatResponse> {
    const response = await fetch(`${PERPLEXITY_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Perplexity Chat API error (${response.status}): ${errorText}`
      );
    }

    return await response.json();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Server is now running and listening for requests
    console.error("Perplexity MCP Server running on stdio");
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new PerplexityMCPServer();
  server.run().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}

export { PerplexityMCPServer };
