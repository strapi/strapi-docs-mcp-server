# Strapi Kapa MCP Server

An MCP (Model Context Protocol) server that integrates your Kapa AI bot with Strapi documentation directly in VSCode/Copilot.

## 🚀 Installation

1. **Clone and install dependencies:**
```bash
./setup.sh
```

2. **Environment variables configuration:**
```bash
cp .env.example .env
# Edit .env with your Kapa API key
```

3. **Compile the project:**
```bash
npm run build
```

## 🔧 Configuration

### Claude Desktop Configuration

Add the MCP configuration to your Claude Desktop configuration file:

**On macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**On Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Copy the content from `mcp-config.json` and adjust the path to your `dist/index.js`.

### VSCode/Copilot Configuration

For VSCode/Copilot integration, you'll need to configure the MCP extension or use the API directly.

## 🛠️ Available Tools

### `query_strapi_docs`
Query Strapi documentation via Kapa AI.

**Parameters:**
- `query` (required): Your question about Strapi
- `context` (optional): Additional context (version, feature)

**Example:**
```typescript
{
  "query": "How to create a custom content type in Strapi v5?",
  "context": "Building a blog with Strapi v5"
}
```

### `get_strapi_best_practices`
Get best practices for specific Strapi topics.

**Parameters:**
- `topic` (required): The Strapi topic
- `project_type` (optional): Project type

### `troubleshoot_strapi_issue`
Help troubleshoot Strapi issues.

**Parameters:**
- `issue_description` (required): Issue description
- `error_message` (optional): Exact error message
- `strapi_version` (optional): Strapi version

## 🔒 Security

- Keep your Kapa API key confidential
- Limit permissions according to your needs
- Monitor API usage to avoid quota overruns

## 📊 Monitoring

The server includes basic error logging. For advanced production monitoring:

1. Add custom metrics
2. Integrate with your existing monitoring tools
3. Configure alerts for API errors

## 🌐 Remote Deployment

To deploy the MCP server remotely (instead of locally):

1. **Deploy to your preferred platform** (Heroku, Vercel, etc.)
2. **Expose an HTTP endpoint** instead of stdio
3. **Configure appropriate authentication**
4. **Adapt the MCP configuration** to point to the remote URL

## 🤝 Contributing

1. Fork the project
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - see the LICENSE file for more details.

## 🆘 Support

For specific questions:
- Strapi Documentation: https://docs.strapi.io
- GitHub Issues: [your-repo]/issues
- Contact Kapa AI for API-related questions

## ⚠️ Current Status

This project is functional but requires correct Kapa API endpoint configuration. We're currently working with the Kapa team to identify the proper API endpoint and authentication format.