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
  thread_id?: string;
  question_answer_id?: string;
  is_uncertain?: boolean;
}

interface KapaQueryRequest {
  query: string;
  context?: string;
  integration_id?: string;
  source_ids_include?: string[];
}

class KapaClient {
  private client: any;
  private projectId: string;

  constructor(apiKey: string, projectId: string, baseURL: string = 'https://api.kapa.ai') {
    this.projectId = projectId;
    
    // Configuration selon la documentation officielle Kapa
    this.client = axios.create({
      baseURL: baseURL,
      headers: {
        'X-API-KEY': apiKey,  // Format exact de la documentation
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Strapi-MCP-Server/1.0'
      },
      timeout: 30000,
    });
  }

  async query(request: KapaQueryRequest): Promise<KapaResponse> {
    try {
      // Endpoint exact selon la documentation
      const endpoint = `/query/v1/projects/${this.projectId}/chat/`;
      
      // Payload selon le format officiel
      const payload = {
        query: request.query,
        // Champs optionnels
        ...(request.integration_id && { integration_id: request.integration_id }),
        ...(request.source_ids_include && { source_ids_include: request.source_ids_include }),
        // Métadonnées pour identifier la source
        user: {
          unique_client_id: 'mcp-server-user',
          metadata: {
            source: 'strapi-mcp-server'
          }
        },
        metadata: {
          origin_url: 'https://docs.strapi.io'
        }
      };

      // Debug logs removed for MCP compatibility
      
      const response = await this.client.post(endpoint, payload);
      
      // Debug: Response received successfully
      
      // Adapter la réponse selon le format officiel de Kapa
      return this.adaptKapaResponse(response.data);
      
    } catch (error: any) {
      // Log to stderr only for MCP compatibility
      console.error('Kapa API Error:', error.response?.data || error.message);
      
      let errorMessage = 'Failed to query Kapa API';
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        switch (status) {
          case 401:
            errorMessage = 'Invalid API key. Please check your KAPA_API_KEY.';
            break;
          case 403:
            errorMessage = 'Access forbidden. Please check your project permissions.';
            break;
          case 404:
            errorMessage = 'Project not found. Please check your KAPA_PROJECT_ID.';
            break;
          case 422:
            errorMessage = `Invalid request: ${data?.detail || 'Please check your request parameters.'}`;
            break;
          case 429:
            errorMessage = 'Rate limit exceeded. Please try again later.';
            break;
          default:
            errorMessage = `API error (${status}): ${data?.detail || data?.message || 'Unknown error'}`;
        }
      } else if (error.request) {
        errorMessage = `Network error: Unable to reach Kapa API at ${error.config?.baseURL}`;
      }
      
      throw new Error(errorMessage);
    }
  }

  private adaptKapaResponse(data: any): KapaResponse {
    // Format de réponse selon la documentation Kapa
    const sources = (data.relevant_sources || []).map((source: any) => ({
      title: source.title || source.name || 'Documentation',
      url: source.source_url || source.url || '#',
      snippet: source.snippet || source.content || source.excerpt || ''
    }));

    return {
      answer: data.answer || 'No answer available',
      sources: sources,
      confidence: data.confidence || (data.is_uncertain ? 0.5 : 0.8),
      thread_id: data.thread_id,
      question_answer_id: data.question_answer_id,
      is_uncertain: data.is_uncertain || false
    };
  }

  async searchDocumentation(query: string, context?: string): Promise<KapaResponse> {
    // Si un contexte est fourni, l'inclure dans la requête
    const enhancedQuery = context 
      ? `Context: ${context}\n\nQuestion: ${query}`
      : query;

    return this.query({
      query: enhancedQuery,
    });
  }

  // Méthode pour tester la connexion avec une requête simple
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const response = await this.query({
        query: "What is Strapi? Please provide a brief answer."
      });
      
      if (response.answer && response.answer.length > 10) {
        return {
          success: true,
          message: "Connection successful",
          details: {
            answer_length: response.answer.length,
            sources_count: response.sources.length,
            thread_id: response.thread_id,
            is_uncertain: response.is_uncertain
          }
        };
      } else {
        return {
          success: false,
          message: "Connection established but received empty response"
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

class StrapiKapaMCPServer {
  private server: any;
  private kapaClient: KapaClient;

  constructor() {
    // Validation des variables d'environnement
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
    this.performStartupTest();
  }

  private async performStartupTest() {
    try {
      const result = await this.kapaClient.testConnection();
      if (result.success) {
        console.error('✅ Kapa API connection successful'); // Use stderr for MCP
      } else {
        console.error('❌ Kapa API connection failed:', result.message);
      }
    } catch (error) {
      console.error('❌ Startup test error:', error);
    }
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
                  description: 'The question or topic you want to search in Strapi documentation (max 15000 characters)',
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
            name: 'test_kapa_connection',
            description: 'Test the connection to Kapa API to verify configuration and API key validity.',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
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
          
          case 'test_kapa_connection':
            return await this.handleTestConnection();
          
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
              text: `❌ Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleTestConnection() {
    try {
      const result = await this.kapaClient.testConnection();
      
      const statusIcon = result.success ? '✅' : '❌';
      let responseText = `${statusIcon} Kapa API Connection Test\n\n`;
      responseText += `Status: ${result.success ? 'SUCCESS' : 'FAILED'}\n`;
      responseText += `Message: ${result.message}\n\n`;

      if (result.details) {
        responseText += `Details:\n`;
        responseText += `- Answer length: ${result.details.answer_length} characters\n`;
        responseText += `- Sources found: ${result.details.sources_count}\n`;
        responseText += `- Thread ID: ${result.details.thread_id}\n`;
        responseText += `- Uncertain: ${result.details.is_uncertain ? 'Yes' : 'No'}\n\n`;
      }

      responseText += `Configuration:\n`;
      responseText += `- API URL: ${process.env.KAPA_API_URL || 'https://api.kapa.ai'}\n`;
      responseText += `- Project ID: ${process.env.KAPA_PROJECT_ID}\n`;
      responseText += `- API Key: ${process.env.KAPA_API_KEY ? '***' + process.env.KAPA_API_KEY.slice(-4) : 'Not set'}`;
      
      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Connection test failed: ${errorMessage}`,
          },
        ],
      };
    }
  }

  private async handleQueryStrapiDocs(args: { query: string; context?: string }) {
    const response = await this.kapaClient.searchDocumentation(args.query, args.context);
    
    let responseText = response.answer;
    
    // Ajouter des informations sur l'incertitude
    if (response.is_uncertain) {
      responseText += '\n\n⚠️ *Note: The AI is uncertain about this answer. Please verify the information.*';
    }
    
    // Ajouter les sources si disponibles
    if (response.sources && response.sources.length > 0) {
      const validSources = response.sources.filter(source => 
        source.url && 
        (source.url.startsWith('http') || source.url.startsWith('https')) &&
        source.url !== '#'
      );
      
      if (validSources.length > 0) {
        responseText += '\n\n**📚 Sources:**\n';
        validSources.forEach((source, index) => {
          let title = source.title || 'Documentation';
          
          // Nettoyer le titre s'il contient des séparateurs
          if (title.includes('|')) {
            const parts = title.split('|');
            const pageTitle = parts[0].trim();
            const sectionTitle = parts[1]?.trim();
            
            if (sectionTitle && sectionTitle !== pageTitle) {
              title = `${pageTitle} - ${sectionTitle}`;
            } else {
              title = pageTitle;
            }
          }
          
          responseText += `${index + 1}. [${title}](${source.url})\n`;
        });
      }
    }
    
    // Ajouter l'ID du thread pour un éventuel suivi
    if (response.thread_id) {
      responseText += `\n\n*Thread ID: ${response.thread_id}*`;
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  }

  private async handleGetBestPractices(args: { topic: string; project_type?: string }) {
    const query = `What are the best practices for ${args.topic} in Strapi${
      args.project_type ? ` for ${args.project_type} projects` : ''
    }? Please provide detailed recommendations, examples, and common pitfalls to avoid.`;

    const response = await this.kapaClient.searchDocumentation(query, 'best practices');
    
    let responseText = `**🎯 Best Practices for ${args.topic}**\n\n${response.answer}`;
    
    if (response.is_uncertain) {
      responseText += '\n\n⚠️ *Note: Please verify these recommendations with the official Strapi documentation.*';
    }
    
    if (response.sources.length > 0) {
      const validSources = response.sources.filter(s => s.url.startsWith('http'));
      if (validSources.length > 0) {
        responseText += `\n\n**📖 References:**\n${validSources.map((source, index) => 
          `${index + 1}. [${source.title}](${source.url})`
        ).join('\n')}`;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  }

  private async handleTroubleshootIssue(args: { 
    issue_description: string; 
    error_message?: string; 
    strapi_version?: string; 
  }) {
    let query = `I'm experiencing this issue with Strapi: ${args.issue_description}`;
    
    if (args.error_message) {
      query += `\n\nSpecific error message: "${args.error_message}"`;
    }
    
    if (args.strapi_version) {
      query += `\n\nI'm using Strapi version: ${args.strapi_version}`;
    }
    
    query += '\n\nHow can I resolve this issue? Please provide step-by-step troubleshooting instructions and possible causes.';

    const response = await this.kapaClient.searchDocumentation(
      query, 
      'troubleshooting and problem solving'
    );
    
    let responseText = `**🔧 Troubleshooting: ${args.issue_description}**\n\n${response.answer}`;
    
    if (response.is_uncertain) {
      responseText += '\n\n⚠️ *If this solution doesn\'t work, consider checking the Strapi community forum or GitHub issues.*';
    }
    
    if (response.sources.length > 0) {
      const validSources = response.sources.filter(s => s.url.startsWith('http'));
      if (validSources.length > 0) {
        responseText += `\n\n**🆘 Helpful Resources:**\n${validSources.map((source, index) => 
          `${index + 1}. [${source.title}](${source.url})`
        ).join('\n')}`;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error: any) => {
      console.error(`[MCP Error] ${error.message || error}`);
    };

    process.on('SIGINT', async () => {
      console.error('\n🛑 Shutting down MCP server...');
      await this.server.close();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  async start(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('🚀 Strapi Kapa MCP Server started successfully'); // Use stderr for MCP
    } catch (error: any) {
      console.error(`[MCP Server Error] ${error.message || error}`);
      process.exit(1);
    }
  }
}

// Validation des variables d'environnement au démarrage
function validateEnvironment() {
  const required = ['KAPA_API_KEY', 'KAPA_PROJECT_ID'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
}

// Démarrage du serveur
validateEnvironment();
const server = new StrapiKapaMCPServer();
server.start().catch((error) => {
  console.error(`[Startup Error] ${error.message || error}`);
  process.exit(1);
});