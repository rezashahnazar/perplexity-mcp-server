# Perplexity MCP Server

A Model Context Protocol (MCP) server that integrates Perplexity AI's chat capabilities into your MCP-compatible applications.

## Overview

This MCP server provides access to Perplexity AI's powerful online LLMs with real-time web search capabilities, allowing you to ask questions and get AI-generated responses with up-to-date information and citations.

## Features

- **Real-time Web Search**: Access current information from the web
- **AI-Powered Responses**: Get intelligent, contextual answers powered by Perplexity's Sonar Pro model
- **Citations**: Responses include citations to source materials
- **Simple Interface**: Easy-to-use chat tool with minimal configuration

## Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
PERPLEXITY_API_KEY=your_api_key_here
```

You can get your Perplexity API key from [Perplexity AI](https://www.perplexity.ai/).

### MCP Client Configuration

Add the server to your MCP client configuration (e.g., Claude Desktop):

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "perplexity": {
      "command": "node",
      "args": ["/absolute/path/to/perplexity-mcp-server/dist/index.js"]
    }
  }
}
```

**Note:** Replace `/absolute/path/to/perplexity-mcp-server` with the actual path where you've installed this server. The `PERPLEXITY_API_KEY` should be set in your `.env` file (see Environment Variables section above).

## Available Tools

### `perplexity_search_chat`

Ask questions and get AI-powered answers with real-time web search from Perplexity AI. This tool searches the web for current information and provides intelligent, contextual responses with citations.

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

**Model:** Uses Perplexity's `sonar-pro` model by default, which provides enhanced accuracy and comprehensive responses with citations.

## Usage

Once configured, the `perplexity_search_chat` tool will be available in your MCP-compatible application. Use it to:

- Ask questions about current events and get up-to-date information
- Get AI-generated responses with citations from reliable sources
- Research topics with access to real-time web data

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
