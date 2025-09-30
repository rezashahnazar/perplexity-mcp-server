// Chat API types based on https://docs.perplexity.ai/api-reference/chat-completions-post

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PerplexityChatParams {
  model: string;
  messages: Message[];
  search_mode?: "academic" | "sec" | "web";
  reasoning_effort?: "low" | "medium" | "high";
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  search_domain_filter?: string[];
  return_images?: boolean;
  return_related_questions?: boolean;
  search_recency_filter?: string;
  search_after_date_filter?: string;
  search_before_date_filter?: string;
  last_updated_after_filter?: string;
  last_updated_before_filter?: string;
  top_k?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
  response_format?: object;
  disable_search?: boolean;
  enable_search_classifier?: boolean;
}

export interface SearchResult {
  title: string;
  url: string;
  date?: string;
}

export interface VideoResult {
  url: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  duration?: number;
}

export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  search_context_size?: string;
  citation_tokens?: number;
  num_search_queries?: number;
  reasoning_tokens?: number;
}

export interface PerplexityChatResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  choices: Array<{
    index: number;
    finish_reason: string | null;
    message: {
      role: string;
      content: string;
    };
  }>;
  usage: UsageInfo;
  search_results?: SearchResult[] | null;
  videos?: VideoResult[] | null;
}
