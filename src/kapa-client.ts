import axios, { AxiosInstance } from 'axios';

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

export class KapaClient {
  private client: AxiosInstance;

  constructor(apiKey: string, projectId: string, baseURL: string = 'https://api.kapa.ai') {
    // Configuration correcte pour l'API Kapa v2
    const fullURL = `${baseURL}/v2/query`;
    
    this.client = axios.create({
      baseURL: fullURL,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async query(request: KapaQueryRequest): Promise<KapaResponse> {
    try {
      const response = await this.client.post('/', {
        query: request.query,
        context: request.context,
        max_sources: request.max_sources || 5,
        // Utilise le project_id dans le payload plutôt que dans l'URL
        project_id: process.env.KAPA_PROJECT_ID,
        source_filter: 'strapi-docs',
      });

      return {
        answer: response.data.answer || 'No answer available',
        sources: response.data.sources || [],
        confidence: response.data.confidence || 0,
      };
    } catch (error) {
      console.error('Kapa API error:', error);
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