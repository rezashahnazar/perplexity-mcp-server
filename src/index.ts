#!/usr/bin/env node

import { PerplexityMCPServer } from "./server.js";

async function main() {
  try {
    const server = new PerplexityMCPServer();
    await server.run();
  } catch (error) {
    console.error("Failed to start Perplexity MCP Server:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
