// Provider-agnostic streaming interface for the complaint drafter.
//
// Two implementations live alongside this file (openai.ts, anthropic.ts).
// The route picks one at request time based on which key is in env.

export type LLMRequest = {
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
  signal?: AbortSignal;
};

export type LLMProvider = {
  name: 'openai' | 'anthropic';
  model: string;
  stream(req: LLMRequest): AsyncGenerator<string>;
};
