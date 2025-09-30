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

// Load environment variables from .env file (if not already set by MCP client)
// Note: dotenv.config() does NOT override existing environment variables,
// so API keys set via mcp.json will take precedence
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
      search_mode: "web",
      return_related_questions: false,
      stream: true,
    };

    const response = await this.callChatAPI(chatParams);

    const content =
      response.choices[0]?.message?.content || "No response generated";

    // Format response with citations if available
    let formattedResponse = content;

    if (response.search_results && response.search_results.length > 0) {
      formattedResponse += "\n\n**Sources:**\n";
      response.search_results.forEach((result, index) => {
        formattedResponse += `${index + 1}. [${result.title}](${result.url})`;
        if (result.date) {
          formattedResponse += ` (${result.date})`;
        }
        formattedResponse += "\n";
      });
    }

    return {
      content: [
        {
          type: "text",
          text: formattedResponse,
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

    // Handle streaming response
    if (params.stream && response.body) {
      return await this.handleStreamResponse(response);
    }

    return await response.json();
  }

  private async handleStreamResponse(
    response: Response
  ): Promise<PerplexityChatResponse> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let accumulatedContent = "";
    let lastChunk: any = null;
    let searchResults: any[] | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              lastChunk = parsed;

              // Accumulate content from delta
              if (parsed.choices?.[0]?.delta?.content) {
                accumulatedContent += parsed.choices[0].delta.content;
              }

              // Capture search results if present
              if (parsed.search_results) {
                searchResults = parsed.search_results;
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Construct a complete response object
    return {
      id: lastChunk?.id || "unknown",
      model: lastChunk?.model || "sonar-pro",
      object: "chat.completion",
      created: lastChunk?.created || Date.now(),
      choices: [
        {
          index: 0,
          finish_reason: lastChunk?.choices?.[0]?.finish_reason || "stop",
          message: {
            role: "assistant",
            content: accumulatedContent,
          },
        },
      ],
      usage: lastChunk?.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
      search_results: searchResults,
    };
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
