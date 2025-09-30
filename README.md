# Perplexity MCP Server

A production-ready Model Context Protocol (MCP) server that integrates Perplexity AI's powerful search capabilities. Get real-time AI-powered answers with web sources and citations through the StreamableHTTP transport.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-1.0-purple)](https://modelcontextprotocol.io/)

## Overview

This MCP server provides seamless integration with Perplexity AI's chat API, enabling AI applications to access current web information through the Model Context Protocol. Built with TypeScript, Express, and the MCP SDK StreamableHTTP transport for efficient, scalable communication.

## Features

- ✅ **Dual Transport Support** - Both Stdio (auto-start) and HTTP (standalone) transports
- ✅ **Real-time Web Search** - Powered by Perplexity's Sonar Pro model
- ✅ **Rich Responses** - AI-generated answers with citations and related images
- ✅ **Flexible Authentication** - Supports Authorization header and environment variables
- ✅ **Production Ready** - Express-based with proper error handling and session management
- ✅ **Universal Compatibility** - Works with any MCP client supporting StreamableHTTP

## Quick Start

### Installation

```bash
# Clone or navigate to the project directory
cd perplexity-mcp-server

# Install dependencies
pnpm install

# Build the project
pnpm build
```

### Running the Server

```bash
# Start the server
pnpm start
```

The server will start on `http://127.0.0.1:3001/mcp`

### Get Your API Key

Sign up and get your Perplexity API key from [https://www.perplexity.ai/](https://www.perplexity.ai/)

## Client Configuration

This server provides **two transport options**:

1. **Stdio Transport** - Auto-starts with MCP client (recommended for simplicity)
2. **HTTP Transport** - Runs as standalone server (recommended for production)

### Option 1: Stdio Transport (Auto-Start)

The client launches the server automatically. **No manual server start required.**

#### Cursor IDE (Stdio)

Create or edit `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project-specific):

```json
{
  "mcpServers": {
    "perplexity": {
      "command": "node",
      "args": ["/absolute/path/to/perplexity-mcp-server/dist/stdio.js"],
      "env": {
        "PERPLEXITY_API_KEY": "YOUR_PERPLEXITY_API_KEY"
      }
    }
  }
}
```

**Note:** Replace `/absolute/path/to/perplexity-mcp-server` with your actual project path.

#### Claude Desktop (Stdio)

Same configuration format:

```json
{
  "mcpServers": {
    "perplexity": {
      "command": "node",
      "args": ["/absolute/path/to/perplexity-mcp-server/dist/stdio.js"],
      "env": {
        "PERPLEXITY_API_KEY": "YOUR_PERPLEXITY_API_KEY"
      }
    }
  }
}
```

### Option 2: HTTP Transport (Standalone Server)

Server runs independently and can serve multiple clients.

**Step 1: Start the server**

```bash
pnpm build
pnpm start
```

**Step 2: Configure Cursor**

Create or edit `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project-specific):

```json
{
  "mcpServers": {
    "perplexity": {
      "url": "http://127.0.0.1:3001/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_PERPLEXITY_API_KEY"
      }
    }
  }
}
```

**Step 3: Restart Cursor**

The `perplexity_search` tool will now be available.

#### Claude Desktop (HTTP)

Same configuration format:

```json
{
  "mcpServers": {
    "perplexity": {
      "url": "http://127.0.0.1:3001/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_PERPLEXITY_API_KEY"
      }
    }
  }
}
```

> **Note:** The server must be running before connecting.

### Other MCP Clients

Any MCP client supporting StreamableHTTP can connect using:

- **Server URL**: `http://127.0.0.1:3001/mcp`
- **Authentication**: `Authorization: Bearer YOUR_PERPLEXITY_API_KEY` header
- **Transport**: StreamableHTTP (SSE-based)

Refer to your MCP client's documentation for specific configuration steps.

### MCP SDK Integration

For direct SDK usage:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client(
  {
    name: "my-client",
    version: "1.0.0",
  },
  {
    capabilities: {},
  }
);

const transport = new StreamableHTTPClientTransport(
  new URL("http://127.0.0.1:3001/mcp"),
  {
    headers: {
      Authorization: "Bearer YOUR_API_KEY",
    },
  }
);

await client.connect(transport);

const result = await client.callTool({
  name: "perplexity_search",
  arguments: {
    query: "What are the latest developments in quantum computing?",
  },
});

console.log(result);
```

## Available Tools

### `perplexity_search`

Search and get AI-powered answers with real-time web data, citations, and images.

**Parameters:**

- `query` (string, required): Your search query or question

**Example:**

```json
{
  "query": "What are the latest developments in AI agents?"
}
```

**Response includes:**

- AI-generated answer based on current web data
- **Sources**: Citations with URLs
- **Related Images**: Relevant images with titles and URLs

**Model Configuration:**

- Model: `sonar-pro` (Perplexity's premier advanced search model)
- Search Recency: `month` (configurable)
- Streaming: Enabled (from Perplexity API, processed server-side)
- Citations: Included
- Images: Included when relevant

## Configuration

### Environment Variables

- `PERPLEXITY_API_KEY`: Your Perplexity API key (optional if using Authorization header)
- `PORT`: Server port (default: 3001)

### API Key Priority

The server accepts API keys from two sources with the following priority:

1. **Authorization Header** (Recommended)

   - Format: `Authorization: Bearer YOUR_API_KEY`
   - Sent per-request via HTTP headers
   - More secure for multi-user scenarios

2. **Environment Variable** (Fallback)
   - Set `PERPLEXITY_API_KEY` when starting the server
   - Shared across all requests

### Usage Examples

**With environment variable:**

```bash
PERPLEXITY_API_KEY=pplx-abc123 PORT=8080 pnpm start
```

**With header authentication:**

```bash
pnpm start
# Client sends: Authorization: Bearer pplx-abc123
```

## Development

### Build

```bash
pnpm build
```

### Development Mode (with auto-reload)

**HTTP Server:**

```bash
pnpm dev
```

**Stdio Server:**

```bash
pnpm dev:stdio
```

### Watch TypeScript Compilation

```bash
pnpm watch
```

### Test with MCP Inspector

**HTTP Server:**

```bash
pnpm inspector
```

**Stdio Server:**

```bash
pnpm inspector:stdio
```

### Health Check

Verify the server is running:

```bash
curl http://127.0.0.1:3001/health
```

Expected response:

```json
{ "status": "ok", "service": "perplexity-mcp-server" }
```

## Architecture

### StreamableHTTP Transport

This server uses the MCP StreamableHTTP transport providing:

- **HTTP/HTTPS** - Standard protocols for web communication
- **Server-Sent Events (SSE)** - Real-time server-to-client messages
- **Session Management** - Stateful sessions with UUID-based IDs
- **Scalability** - Multiple concurrent connections
- **Infrastructure Compatibility** - Works with proxies, load balancers, and CDNs

### Request Flow

1. Client sends HTTP POST to `/mcp` endpoint
2. Express extracts Authorization header → API key
3. Request forwarded to MCP transport
4. Tool handler receives request with API key
5. Server calls Perplexity API with streaming
6. Response parsed and formatted with citations/images
7. Complete response returned via MCP protocol

### Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.3+
- **Framework**: Express 5
- **MCP SDK**: @modelcontextprotocol/sdk
- **HTTP Client**: node-fetch 3
- **Validation**: Zod 3

## Production Deployment

### Security Best Practices

1. **API Key Security**

   - Use environment variables or secure vaults
   - Never commit API keys to version control
   - Rotate keys regularly

2. **Network Security**

   - Server binds to `127.0.0.1` (localhost) by default
   - Use reverse proxy (nginx, Caddy) with SSL/TLS for production
   - Configure firewall rules appropriately

3. **Input Validation**

   - All inputs validated with Zod schemas
   - Query length limits enforced

4. **Rate Limiting**
   - Consider adding rate limiting middleware
   - Monitor Perplexity API usage

### Reverse Proxy Example (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name mcp.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /mcp {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Process Management (PM2)

```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start dist/server.js --name perplexity-mcp

# With environment variables
pm2 start dist/server.js --name perplexity-mcp \
  --env PERPLEXITY_API_KEY=your-key \
  --env PORT=3001

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 3001

CMD ["node", "dist/server.js"]
```

## Troubleshooting

### Common Issues

**Error: "PERPLEXITY_API_KEY is required"**

- Ensure API key is provided via Authorization header or environment variable
- Check header format: `Authorization: Bearer YOUR_KEY`
- Verify the server receives the header (check logs)

**Connection Refused**

- Verify server is running: `curl http://127.0.0.1:3001/health`
- Check port matches configuration
- Ensure no firewall is blocking the port

**Citations or Images showing as "Untitled" or broken links**

- This should be fixed in the latest version
- Rebuild: `pnpm build && pnpm start`
- Verify you're running the latest code

**Cursor IDE not finding server**

- Ensure server is running before starting Cursor
- Check `~/.cursor/mcp.json` syntax is valid JSON
- Restart Cursor after configuration changes
- Check Cursor's MCP panel for connection status

## API Reference

### Perplexity API

- **Documentation**: [https://docs.perplexity.ai/](https://docs.perplexity.ai/)
- **API Reference**: [https://docs.perplexity.ai/api-reference/chat-completions](https://docs.perplexity.ai/api-reference/chat-completions)
- **Model Cards**: [https://docs.perplexity.ai/guides/model-cards](https://docs.perplexity.ai/guides/model-cards)

### Model Context Protocol

- **MCP Docs**: [https://modelcontextprotocol.io/](https://modelcontextprotocol.io/)
- **Specification**: [https://spec.modelcontextprotocol.io/](https://spec.modelcontextprotocol.io/)
- **TypeScript SDK**: [https://github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk)

## Project Structure

```
perplexity-mcp-server/
├── src/
│   ├── server.ts          # HTTP transport server (StreamableHTTP)
│   └── stdio.ts           # Stdio transport server (auto-start)
├── dist/                  # Compiled JavaScript output
│   ├── server.js          # HTTP server executable
│   └── stdio.js           # Stdio server executable
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── mcp.json.example     # Example MCP client config
└── README.md            # This file
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

## Acknowledgments

Built with:

- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- [Perplexity AI](https://www.perplexity.ai/)
- [Express](https://expressjs.com/)
- [TypeScript](https://www.typescriptlang.org/)

---

**Made with ❤️ using the Model Context Protocol**
