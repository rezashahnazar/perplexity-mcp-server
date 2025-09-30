// Search API types
export interface PerplexitySearchParams {
  query: string | string[];
  max_results?: number;
  max_tokens_per_page?: number;
  country?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  last_updated?: string;
}

export interface PerplexitySearchResponse {
  results: SearchResult[] | SearchResult[][];
  id: string;
}

// Chat API types
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PerplexityChatParams {
  model: string;
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  search_domain_filter?: string[];
  search_recency_filter?: "month" | "week" | "day" | "hour";
  return_citations?: boolean;
  return_images?: boolean;
}

export interface PerplexityChatResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
    delta?: {
      role?: string;
      content?: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
