#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fetch, { Response } from "node-fetch";

// Validation schema for the search query
const SearchQuerySchema = z.object({
  query: z
    .string()
    .describe("The search query or question to send to Perplexity"),
});

/**
 * Perplexity MCP Server (Stdio Transport)
 *
 * This server provides a single tool that proxies requests to Perplexity's
 * streaming chat completions API and returns complete responses to the MCP client.
 * Uses stdio transport for direct integration with MCP clients.
 */
class PerplexityMCPStdioServer {
  private server: Server;
  private readonly PERPLEXITY_API_URL =
    "https://api.perplexity.ai/chat/completions";
  private readonly MODEL = "sonar-pro";

  constructor() {
    // Initialize the MCP server
    this.server = new Server(
      {
        name: "perplexity-stdio-server",
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
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "perplexity_search",
          description:
            "Search and get answers using Perplexity's AI with real-time web data and citations",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "The search query or question to send to Perplexity",
              },
            },
            required: ["query"],
          },
        },
      ],
    }));

    // Handle tool execution
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request, extra) => {
        const { name, arguments: args } = request.params;

        if (name !== "perplexity_search") {
          throw new Error(`Unknown tool: ${name}`);
        }

        // Validate input
        const parsed = SearchQuerySchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Invalid arguments: ${parsed.error.message}`);
        }

        const { query } = parsed.data;

        // Get API key from environment variable (set by MCP client)
        const apiKey = process.env.PERPLEXITY_API_KEY;
        if (!apiKey) {
          throw new Error(
            "PERPLEXITY_API_KEY environment variable is required"
          );
        }

        return this.streamPerplexityResponse(query, apiKey);
      }
    );
  }

  private async streamPerplexityResponse(query: string, apiKey: string) {
    const requestPayload = {
      model: this.MODEL,
      messages: [
        {
          role: "user" as const,
          content: query,
        },
      ],
      stream: true,
      return_related_questions: false,
      // Additional Perplexity-specific configurations
      search_recency_filter: "month",
      return_images: true,
      return_citations: true,
    };

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };

    try {
      const response = await fetch(this.PERPLEXITY_API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Perplexity API error: ${response.status} - ${errorText}`
        );
      }

      if (!response.body) {
        throw new Error("No response body received from Perplexity API");
      }

      // Return a streaming response that will be handled by the MCP transport
      return {
        content: [
          {
            type: "text",
            text: await this.processStreamingResponse(response),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error("Error calling Perplexity API:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : "Unknown error occurred"
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  private async processStreamingResponse(response: Response): Promise<string> {
    const decoder = new TextDecoder();
    let result = "";
    let citations: any[] = [];
    let images: any[] = [];
    let buffer = "";

    try {
      // node-fetch returns a Node.js Readable stream, not Web Streams API
      // We need to handle it as an async iterable
      for await (const chunk of response.body as any) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (!trimmedLine || trimmedLine === "data: [DONE]") {
            continue;
          }

          if (trimmedLine.startsWith("data: ")) {
            const data = trimmedLine.slice(6).trim();

            try {
              const parsed = JSON.parse(data);

              // Extract content from the streaming chunk
              if (parsed.choices?.[0]?.delta?.content) {
                result += parsed.choices[0].delta.content;
              }

              // Collect citations from final chunks
              if (parsed.citations && Array.isArray(parsed.citations)) {
                citations = parsed.citations;
              }

              // Collect images from final chunks
              if (parsed.images && Array.isArray(parsed.images)) {
                images = parsed.images;
              }
            } catch (parseError) {
              // Skip invalid JSON chunks
              continue;
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing stream:", error);
      throw error;
    }

    // Format the final response with citations
    let formattedResult = result;

    if (citations.length > 0) {
      formattedResult += "\n\n**Sources:**\n";
      citations.forEach((citation, index) => {
        // Handle different citation formats:
        // - String URL: "https://example.com"
        // - Object: { url: "...", title: "..." } or { text: "...", url: "..." }
        if (typeof citation === "string") {
          formattedResult += `${index + 1}. ${citation}\n`;
        } else if (citation && typeof citation === "object") {
          const url = citation.url || citation.link || "#";
          const title = citation.title || citation.name || citation.text || url;
          formattedResult += `${index + 1}. [${title}](${url})\n`;
        }
      });
    }

    if (images.length > 0) {
      formattedResult += "\n\n**Related Images:**\n";
      images.forEach((image, index) => {
        // Handle different image formats:
        // - String URL: "https://example.com/image.jpg"
        // - Object: { image_url: "...", title: "..." } (Perplexity format)
        if (typeof image === "string") {
          formattedResult += `${index + 1}. ![Image ${index + 1}](${image})\n`;
        } else if (image && typeof image === "object") {
          const url = image.image_url || image.url || image.src || image.link;
          const title = image.title || `Image ${index + 1}`;
          if (url) {
            formattedResult += `${index + 1}. [${title}](${url})\n`;
          }
        }
      });
    }

    return formattedResult;
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Perplexity MCP Server (stdio) running");
  }
}

// Start the server
const server = new PerplexityMCPStdioServer();
server.run().catch(console.error);
