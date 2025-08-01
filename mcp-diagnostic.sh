#!/bin/bash

echo "🔍 Strapi-Kapa MCP Server Diagnostic"
echo "====================================="

echo ""
echo "1. 📁 File structure verification:"
echo "-----------------------------------"
if [ -f "dist/index.js" ]; then
    echo "✅ dist/index.js exists"
else
    echo "❌ dist/index.js missing - You need to run 'yarn build'"
fi

if [ -f ".env" ]; then
    echo "✅ .env exists"
    echo "   Content masked for security:"
    grep -E "^[A-Z_]+" .env | sed 's/=.*/=***/' || echo "   .env file is empty or malformed"
else
    echo "❌ .env missing - Copy .env.example to .env"
fi

echo ""
echo "2. 🔧 MCP server execution test:"
echo "---------------------------------"
echo "Server launch test (auto-stop after 3 seconds):"

# Execution test with timeout
timeout 3s node dist/index.js 2>&1 | head -5 || echo "Error or timeout reached"

echo ""
echo "3. 📋 Claude Desktop configuration detected:"
echo "---------------------------------------------"

CLAUDE_CONFIG_MAC="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
CLAUDE_CONFIG_WIN="$APPDATA/Claude/claude_desktop_config.json"

if [ -f "$CLAUDE_CONFIG_MAC" ]; then
    echo "✅ macOS configuration found: $CLAUDE_CONFIG_MAC"
    echo "   Configured MCP servers:"
    cat "$CLAUDE_CONFIG_MAC" | grep -A 5 -B 1 "strapi" || echo "   No Strapi server found in config"
elif [ -f "$CLAUDE_CONFIG_WIN" ]; then
    echo "✅ Windows configuration found: $CLAUDE_CONFIG_WIN"
    echo "   Configured MCP servers:"
    cat "$CLAUDE_CONFIG_WIN" | grep -A 5 -B 1 "strapi" || echo "   No Strapi server found in config"
else
    echo "❌ No Claude Desktop configuration found"
    echo "   Check the paths:"
    echo "   - macOS: $CLAUDE_CONFIG_MAC"
    echo "   - Windows: $CLAUDE_CONFIG_WIN"
fi

echo ""
echo "4. 🧪 Node.js dependencies test:"
echo "---------------------------------"
echo "Node.js version:"
node --version

echo "NPM/Yarn version:"
if command -v yarn &> /dev/null; then
    yarn --version
else
    npm --version
fi

echo ""
echo "Installed modules (MCP SDK):"
if [ -f "package.json" ]; then
    cat package.json | grep -A 5 -B 5 "modelcontextprotocol" || echo "   MCP SDK not found in package.json"
else
    echo "❌ package.json missing"
fi

echo ""
echo "5. 💡 Troubleshooting tips:"
echo "----------------------------"
echo "• If dist/index.js is missing: run 'yarn build'"
echo "• If environment variable errors: check your .env file"
echo "• If Claude can't find the server: check the path in claude_desktop_config.json"
echo "• For debugging: run 'node dist/index.js' manually and check errors"
echo "• Claude Desktop logs (macOS): ~/Library/Logs/Claude/"

echo ""
echo "✅ Diagnostic completed!"