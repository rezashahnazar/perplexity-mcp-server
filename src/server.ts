#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";

// Load environment variables from .env file (if not already set by MCP client)
// Note: dotenv.config() does NOT override existing environment variables,
// so API keys set via mcp.json will take precedence
dotenv.config();

const PERPLEXITY_API_BASE = "https://api.perplexity.ai";

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
            name: "search_chat",
            description:
              "Ask questions and get AI-powered answers with real-time web search from Perplexity AI. Use this when you need current information, facts, research, news, or any query that benefits from up-to-date web sources. Best for: current events, research questions, factual queries, technical documentation lookups, and any information that requires recent or authoritative web sources.",
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
        if (name === "search_chat") {
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
    try {
      // Validate API key at runtime (not at startup)
      const apiKey = process.env.PERPLEXITY_API_KEY;
      if (!apiKey) {
        throw new Error(
          "PERPLEXITY_API_KEY environment variable is required. Please set it in your MCP client configuration."
        );
      }

      let fullResponse = "";
      const streamChunks: string[] = [];

      // Collect streaming response
      for await (const chunk of this.streamPerplexityCompletion(
        args.content,
        apiKey
      )) {
        fullResponse += chunk;
        streamChunks.push(chunk);
      }

      // Return the complete response
      return {
        content: [
          {
            type: "text",
            text: fullResponse,
          },
        ],
        isError: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  // Server-Sent Events parser utility
  private parseSSEChunk(
    chunk: string
  ): Array<{ data: string; event?: string }> {
    const events: Array<{ data: string; event?: string }> = [];
    const lines = chunk.split("\n");
    let currentEvent: { data?: string; event?: string } = {};

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine === "") {
        // Empty line indicates end of event
        if (currentEvent.data !== undefined) {
          events.push(currentEvent as { data: string; event?: string });
          currentEvent = {};
        }
      } else if (trimmedLine.startsWith("data: ")) {
        currentEvent.data = trimmedLine.slice(6); // Remove 'data: ' prefix
      } else if (trimmedLine.startsWith("event: ")) {
        currentEvent.event = trimmedLine.slice(7); // Remove 'event: ' prefix
      }
    }

    // Handle case where chunk doesn't end with empty line
    if (currentEvent.data !== undefined) {
      events.push(currentEvent as { data: string; event?: string });
    }

    return events;
  }

  // Perplexity streaming API call
  private async *streamPerplexityCompletion(
    query: string,
    apiKey: string
  ): AsyncGenerator<string, void, unknown> {
    const requestBody = {
      model: "sonar-pro",
      messages: [
        {
          role: "user" as const,
          content: query,
        },
      ],
      stream: true,
      search_mode: "web",
      return_images: false,
      return_related_questions: false,
      max_tokens: 4000,
      temperature: 0.2,
      top_p: 0.9,
      top_k: 0,
      presence_penalty: 0,
      frequency_penalty: 1.0,
    };

    const response = await fetch(`${PERPLEXITY_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Perplexity API error (${response.status}): ${errorText}`
      );
    }

    if (!response.body) {
      throw new Error("No response body received from Perplexity API");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === "") continue;

          const events = this.parseSSEChunk(line + "\n");

          for (const event of events) {
            if (event.data === "[DONE]") {
              return;
            }

            try {
              const parsed = JSON.parse(event.data);
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                yield content;
              }
            } catch (parseError) {
              // Skip malformed JSON chunks
              console.warn("Failed to parse SSE chunk:", event.data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
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
