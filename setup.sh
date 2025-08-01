#!/bin/bash

echo "🚀 Setting up Strapi Kapa MCP Server"

# Create project directory
mkdir -p strapi-kapa-mcp-server
cd strapi-kapa-mcp-server

# Initialize npm project
npm init -y

# Install dependencies
echo "📦 Installing dependencies..."
npm install @modelcontextprotocol/sdk axios dotenv
npm install -D @types/node tsx typescript

# Create source directory
mkdir -p src

echo "✨ Project structure created!"
echo ""
echo "Next steps:"
echo "1. Copy the TypeScript files to src/"
echo "2. Copy the configuration files to the root"
echo "3. Set up your .env file with Kapa API key"
echo "4. Run 'npm run build' to compile"
echo "5. Configure Claude Desktop with the mcp-config.json"
echo ""
echo "🔑 Don't forget to get your Kapa API key from your Kapa dashboard!"
echo "📁 Update the path in mcp-config.json to point to your dist/index.js file"