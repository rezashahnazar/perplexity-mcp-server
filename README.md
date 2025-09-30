# Perplexity MCP Server

A Model Context Protocol (MCP) server that integrates Perplexity AI's chat capabilities into your MCP-compatible applications.

## Overview

This MCP server provides access to Perplexity AI's powerful online LLMs with real-time web search capabilities, allowing you to ask questions and get AI-generated responses with up-to-date information.

## Features

- **Real-time Web Search**: Access current information from the web
- **AI-Powered Responses**: Get intelligent, contextual answers powered by Perplexity's Sonar Pro model
- **Streaming Architecture**: Streams responses from Perplexity API for efficient processing, returns complete response to MCP client
- **Clean Responses**: Concise answers without citations or references
- **Simple Interface**: Easy-to-use chat tool with minimal configuration

## Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build
```

## Configuration

### API Key Setup

The API key is validated at runtime when the tool is called, not at server startup. This allows the server to start successfully and receive the API key from the MCP client.

**For MCP Clients (Cursor, Claude Desktop):**
The API key is provided through the MCP client configuration (see below). No `.env` file is needed.

**For Local Testing (optional):**
If you want to test the server directly with `pnpm start`, create a `.env` file:

```env
PERPLEXITY_API_KEY=your_api_key_here
```

You can get your Perplexity API key from [Perplexity AI](https://www.perplexity.ai/).

### MCP Client Configuration

#### For Cursor IDE

1. Create a `.cursor/mcp.json` file in the project root (or use the provided `mcp.json.example` as a template):

   ```bash
   mkdir -p .cursor
   cp mcp.json.example .cursor/mcp.json
   ```

2. Edit `.cursor/mcp.json` and update:
   - The absolute path to your `dist/index.js` file
   - Your Perplexity API key

The configuration file should look like:

```json
{
  "mcpServers": {
    "perplexity": {
      "command": "node",
      "args": ["/absolute/path/to/perplexity-mcp-server/dist/index.js"],
      "env": {
        "PERPLEXITY_API_KEY": "your-perplexity-api-key-here"
      }
    }
  }
}
```

3. Restart Cursor IDE to load the MCP server

#### For Claude Desktop

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "perplexity": {
      "command": "node",
      "args": ["/absolute/path/to/perplexity-mcp-server/dist/index.js"],
      "env": {
        "PERPLEXITY_API_KEY": "your-perplexity-api-key-here"
      }
    }
  }
}
```

**Note:** Replace `/absolute/path/to/perplexity-mcp-server` with the actual path and add your Perplexity API key.

## Available Tools

### `search_chat`

Ask questions and get AI-powered answers with real-time web search from Perplexity AI. This tool searches the web for current information and provides intelligent, contextual responses.

**When to use:**

- Current events and news
- Research questions requiring up-to-date information
- Factual queries that need authoritative sources
- Technical documentation lookups
- Any information requiring recent or verified web sources

**Parameters:**

- `content` (string, required): The question or query to ask Perplexity AI

**Example:**

```json
{
  "content": "What are the latest developments in AI?"
}
```

**Configuration:**

- **Model:** `sonar-pro` (Perplexity's premier advanced search model)
- **Search Mode:** `web` (general web search)
- **Max Tokens:** 4000 (maximum response length)
- **Temperature:** 0.2 (focused and deterministic responses)
- **Top P:** 0.9 (nucleus sampling for quality)
- **Top K:** 0 (disabled)
- **Frequency Penalty:** 1.0 (reduces repetition)
- **Presence Penalty:** 0 (neutral)
- **Streaming:** Enabled (streams from Perplexity API, returns complete response to client)
- **Return Images:** Disabled
- **Related Questions:** Disabled
- **Citations:** Not included in response (clean answer only)

## Usage

Once configured, the `search_chat` tool will be available in your MCP-compatible application. Use it to:

- Ask questions about current events and get up-to-date information
- Get AI-generated responses powered by real-time web search
- Research topics with access to current web data

## Development

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Watch mode for development
pnpm run dev

# Test with MCP Inspector
pnpm run inspect
```

## API Documentation

This server is built using the following Perplexity AI APIs:

- **Chat API Documentation**: [https://docs.perplexity.ai/getting-started/quickstart](https://docs.perplexity.ai/getting-started/quickstart)
- **API Reference**: [https://docs.perplexity.ai/api-reference/chat-completions](https://docs.perplexity.ai/api-reference/chat-completions)

For more information about Perplexity AI's capabilities, visit:

- **Perplexity Documentation**: [https://docs.perplexity.ai/](https://docs.perplexity.ai/)

## Model Context Protocol

This server implements the Model Context Protocol (MCP), which enables seamless integration between AI applications and external tools/data sources.

Learn more about MCP:

- **MCP Documentation**: [https://modelcontextprotocol.io/](https://modelcontextprotocol.io/)
- **MCP Specification**: [https://spec.modelcontextprotocol.io/](https://spec.modelcontextprotocol.io/)

## License

MIT
