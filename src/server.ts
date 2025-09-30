import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fetch, { Response } from "node-fetch";
import express from "express";
import { randomUUID } from "crypto";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Validation schema for the search query
const SearchQuerySchema = z.object({
  query: z
    .string()
    .describe("The search query or question to send to Perplexity"),
});

/**
 * Perplexity Streaming MCP Server
 *
 * This server provides a single tool that proxies requests to Perplexity's
 * streaming chat completions API and streams the responses back to the MCP client.
 */
class PerplexityMCPServer {
  private server: Server;
  private readonly PERPLEXITY_API_URL =
    "https://api.perplexity.ai/chat/completions";
  private readonly MODEL = "sonar-pro";
  private currentApiKey: string | null = null;

  constructor() {
    // Initialize the MCP server
    this.server = new Server(
      {
        name: "perplexity-streaming-server",
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

        // Get API key from environment variable as fallback
        let apiKey = process.env.PERPLEXITY_API_KEY;

        // Note: API key from Authorization header is extracted in Express middleware
        // and stored globally for this request. This is a workaround since MCP SDK
        // doesn't easily expose custom headers to tool handlers.
        if (this.currentApiKey) {
          apiKey = this.currentApiKey;
        }

        if (!apiKey) {
          throw new Error(
            "PERPLEXITY_API_KEY is required. Provide it via Authorization header (Bearer token) or PERPLEXITY_API_KEY environment variable."
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
      console.log("Shutting down MCP server...");
      await this.server.close();
      process.exit(0);
    });
  }

  private async checkPortInUse(port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`lsof -ti:${port}`);
      return stdout.trim().length > 0;
    } catch (error) {
      // lsof returns non-zero exit code if port is not in use
      return false;
    }
  }

  private async getProcessUsingPort(port: number): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`lsof -ti:${port}`);
      const pid = stdout.trim();
      if (pid) {
        const { stdout: processInfo } = await execAsync(
          `ps -p ${pid} -o command=`
        );
        return `PID ${pid}: ${processInfo.trim()}`;
      }
    } catch (error) {
      // Ignore errors
    }
    return null;
  }

  async start(port: number = 3001): Promise<void> {
    // Check if port is already in use
    const portInUse = await this.checkPortInUse(port);
    if (portInUse) {
      const processInfo = await this.getProcessUsingPort(port);
      console.error(`\n❌ ERROR: Port ${port} is already in use!`);
      if (processInfo) {
        console.error(`   Process: ${processInfo}`);
      }
      console.error(`\n💡 To fix this, you can:`);
      console.error(`   1. Stop the existing server (Ctrl+C in its terminal)`);
      console.error(`   2. Use a different port: PORT=3002 pnpm start`);
      console.error(`   3. Kill the process: kill -9 $(lsof -ti:${port})`);
      console.error(`   4. Find and stop it: lsof -ti:${port} | xargs ps -p\n`);
      process.exit(1);
    }

    const app = express();
    app.use(express.json());

    // Create StreamableHTTP transport with session management
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    // Connect the MCP server to the transport
    await this.server.connect(transport);

    // Handle all MCP requests at the /mcp endpoint
    app.all("/mcp", async (req, res) => {
      // Extract Authorization header and store it temporarily
      if (req.headers.authorization) {
        const authHeader = req.headers.authorization;
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (match) {
          this.currentApiKey = match[1];
        }
      } else {
        this.currentApiKey = null;
      }

      try {
        // Pass the parsed body as third parameter since express.json() already consumed the stream
        await transport.handleRequest(req, res, req.body);
      } finally {
        // Clear the API key after request is handled
        this.currentApiKey = null;
      }
    });

    // Health check endpoint
    app.get("/health", (req, res) => {
      res.json({ status: "ok", service: "perplexity-mcp-server" });
    });

    // Start the HTTP server
    return new Promise<void>((resolve) => {
      const httpServer = app.listen(port, "127.0.0.1", () => {
        console.log(
          `Starting Perplexity MCP server on http://127.0.0.1:${port}/mcp`
        );
        console.log("Perplexity MCP server is running!");
        resolve();
      });

      // Keep the server alive
      httpServer.on("error", (error) => {
        console.error("HTTP server error:", error);
        process.exit(1);
      });

      // Handle graceful shutdown
      process.on("SIGTERM", async () => {
        console.log("SIGTERM received, shutting down gracefully...");
        httpServer.close(() => {
          console.log("HTTP server closed");
        });
        await this.server.close();
        process.exit(0);
      });
    });
  }
}

// Start the server
const server = new PerplexityMCPServer();

// Get port from environment or use default
const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

server.start(port).catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
