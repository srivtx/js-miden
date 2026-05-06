import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-test' });
const MAX_STREAM_TIMEOUT_MS = 30000;

export async function* streamCompletion(prompt: string, maxTokens: number, temperature: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAX_STREAM_TIMEOUT_MS);

  try {
    const stream = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
        stream: true,
      },
      { signal: controller.signal }
    );

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        yield content;
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

// BUGGY: No timeout on LLM stream - hangs forever, burns tokens
export async function* streamCompletionNoTimeout(prompt: string, maxTokens: number, temperature: number) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      yield content;
    }
  }
}
