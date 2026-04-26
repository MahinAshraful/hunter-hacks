import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMRequest } from './types';

const MODEL = 'claude-sonnet-4-6';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured.');
  client = new Anthropic({ apiKey });
  return client;
}

async function* streamText(req: LLMRequest): AsyncGenerator<string> {
  const stream = getClient().messages.stream(
    {
      model: MODEL,
      max_tokens: req.maxTokens,
      system: [
        {
          type: 'text',
          text: req.systemPrompt,
          // Ephemeral cache: every complaint reuses the system prompt verbatim,
          // so the cache hit zeroes the prefill cost on re-runs within the TTL.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: req.userMessage }],
    },
    { signal: req.signal },
  );

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}

export const anthropicProvider: LLMProvider = {
  name: 'anthropic',
  model: MODEL,
  stream: streamText,
};
