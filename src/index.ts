const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');

interface KapaResponse {
  answer: string;
  sources: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  confidence: number;
}

interface KapaQueryRequest {
  query: string;
  context?: string;
  max_sources?: number;
}

class KapaClient {
  private client: any;
  private projectId: string;

  constructor(apiKey: string, projectId: string, baseURL: string = 'https://api.kapa.ai') {
    this.projectId = projectId;
    // Utiliser le format exact du GitHub Workflow qui fonctionne
    this.client = axios.create({
      baseURL: `${baseURL}/query/v1/projects/${projectId}/chat`,
      headers: {
        'X-API-Key': apiKey,  // Utiliser X-API-Key comme dans le workflow
        'Content-Type': 'application/json',
        'User-Agent': 'Strapi-MCP-Server/1.0'
      },
      timeout: 120000, // 2 minutes comme dans le workflow
    });
  }

  async query(request: KapaQueryRequest): Promise<KapaResponse> {
    try {
      const response = await this.client.post('/', {
        query: request.query,
        max_sources: request.max_sources || 5,
        user_data: {
          source: 'mcp-server',
          context: request.context || 'strapi-documentation'
        }
      });

      // Utiliser la structure de réponse exacte du workflow
      return {
        answer: response.data.answer || 'No answer available',
        sources: response.data.relevant_sources || [],
        confidence: response.data.confidence || 0,
      };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to query Kapa API: ${errorMessage}`);
    }
  }

  async searchDocumentation(query: string, context?: string): Promise<KapaResponse> {
    const enhancedQuery = context 
      ? `${query}\n\nContext: ${context}`
      : query;

    return this.query({
      query: enhancedQuery,
      max_sources: 5,
    });
  }
}

class StrapiKapaMCPServer {
  private server: any;
  private kapaClient: KapaClient;

  constructor() {
    if (!process.env.KAPA_API_KEY) {
      throw new Error('KAPA_API_KEY environment variable is required');
    }
    if (!process.env.KAPA_PROJECT_ID) {
      throw new Error('KAPA_PROJECT_ID environment variable is required');
    }

    this.server = new Server(
      {
        name: process.env.MCP_SERVER_NAME || 'strapi-docs',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.kapaClient = new KapaClient(
      process.env.KAPA_API_KEY!,
      process.env.KAPA_PROJECT_ID!,
      process.env.KAPA_API_URL || 'https://api.kapa.ai'
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'query_strapi_docs',
            description: 'Query Strapi documentation using Kapa AI assistant. Provides detailed answers with sources from official Strapi documentation.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The question or topic you want to search in Strapi documentation',
                },
                context: {
                  type: 'string',
                  description: 'Optional context about your current development situation (e.g., version, specific feature)',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_strapi_best_practices',
            description: 'Get Strapi best practices and recommendations for specific topics or features.',
            inputSchema: {
              type: 'object',
              properties: {
                topic: {
                  type: 'string',
                  description: 'The Strapi topic or feature you want best practices for (e.g., "content types", "plugins", "deployment")',
                },
                project_type: {
                  type: 'string',
                  description: 'Type of project (e.g., "REST API", "GraphQL", "headless CMS")',
                },
              },
              required: ['topic'],
            },
          },
          {
            name: 'troubleshoot_strapi_issue',
            description: 'Get help troubleshooting specific Strapi issues or errors.',
            inputSchema: {
              type: 'object',
              properties: {
                issue_description: {
                  type: 'string',
                  description: 'Detailed description of the issue or error you are experiencing',
                },
                error_message: {
                  type: 'string',
                  description: 'The exact error message if available',
                },
                strapi_version: {
                  type: 'string',
                  description: 'Your Strapi version (e.g., "4.15.0", "5.0.0")',
                },
              },
              required: ['issue_description'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'query_strapi_docs':
            return await this.handleQueryStrapiDocs(args as any);
          
          case 'get_strapi_best_practices':
            return await this.handleGetBestPractices(args as any);
          
          case 'troubleshoot_strapi_issue':
            return await this.handleTroubleshootIssue(args as any);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleQueryStrapiDocs(args: { query: string; context?: string }) {
    const response = await this.kapaClient.searchDocumentation(args.query, args.context);
    
    let sourcesText = '';
    if (response.sources && response.sources.length > 0) {
      const formattedSources = response.sources
        .filter((source: any) => source.source_url && source.source_url.startsWith('http'))
        .map((source: any, index: number) => {
          let title = source.title || 'Documentation';
          
          // Handle pipe-separated title|subtitle format like in the workflow
          if (title.includes('|')) {
            const parts = title.split('|');
            const pageTitle = parts[0].trim();
            const sectionTitle = parts[1].trim();
            
            if (sectionTitle && sectionTitle !== pageTitle) {
              title = `${pageTitle} - ${sectionTitle}`;
            } else {
              title = pageTitle;
            }
          }
          
          return `${index + 1}. [${title}](${source.source_url})`;
        });
      
      if (formattedSources.length > 0) {
        sourcesText = `\n\n**Sources:**\n${formattedSources.join('\n')}`;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `${response.answer}${sourcesText}`,
        },
      ],
    };
  }

  private async handleGetBestPractices(args: { topic: string; project_type?: string }) {
    const query = `What are the best practices for ${args.topic} in Strapi${
      args.project_type ? ` for ${args.project_type} projects` : ''
    }? Please provide detailed recommendations and examples.`;

    const response = await this.kapaClient.searchDocumentation(query);
    
    const sourcesText = response.sources.length > 0
      ? `\n\n**References:**\n${response.sources.map((source, index) => 
          `${index + 1}. [${source.title}](${source.url})`
        ).join('\n')}`
      : '';

    return {
      content: [
        {
          type: 'text',
          text: `**Best Practices for ${args.topic}:**\n\n${response.answer}${sourcesText}`,
        },
      ],
    };
  }

  private async handleTroubleshootIssue(args: { 
    issue_description: string; 
    error_message?: string; 
    strapi_version?: string; 
  }) {
    let query = `I'm having an issue with Strapi: ${args.issue_description}`;
    
    if (args.error_message) {
      query += `\n\nError message: ${args.error_message}`;
    }
    
    if (args.strapi_version) {
      query += `\n\nStrapi version: ${args.strapi_version}`;
    }
    
    query += '\n\nHow can I fix this? Please provide step-by-step solutions.';

    const response = await this.kapaClient.searchDocumentation(query);
    
    const sourcesText = response.sources.length > 0
      ? `\n\n**Helpful Resources:**\n${response.sources.map((source, index) => 
          `${index + 1}. [${source.title}](${source.url})`
        ).join('\n')}`
      : '';

    return {
      content: [
        {
          type: 'text',
          text: `**Troubleshooting Solution:**\n\n${response.answer}${sourcesText}`,
        },
      ],
    };
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error: any) => {
      process.stderr.write(`[MCP Error] ${error.message}\n`);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async start(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
    } catch (error: any) {
      process.stderr.write(`[MCP Server Error] ${error.message}\n`);
      process.exit(1);
    }
  }
}

const server = new StrapiKapaMCPServer();
server.start().catch((error) => {
  process.stderr.write(`[Startup Error] ${error.message}\n`);
  process.exit(1);
});