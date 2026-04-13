import { streamText, generateText } from 'ai';
import type { ChatMessage, ChatOptions, ChatChunk, ModelID } from './types.ts';
import { providerRegistry } from './registry.ts';
import { resolveModel, getModelInfo } from './router.ts';

export async function* chat(
  messages: ChatMessage[],
  options: ChatOptions = {},
): AsyncGenerator<ChatChunk> {
  const modelId: ModelID = options.model ?? resolveModel('standard');
  const modelInfo = getModelInfo(modelId);
  if (!modelInfo) throw new Error(`Unknown model: ${modelId}`);

  const providerId = modelInfo.providerId;

  // Get provider model instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let providerModel: any;
  if (providerId === 'anthropic') {
    const provider = await providerRegistry.getAnthropicProvider();
    providerModel = provider(modelId as string);
  } else if (providerId === 'google') {
    const provider = await providerRegistry.getGoogleProvider();
    providerModel = provider(modelId as string);
  } else if (providerId === 'openai') {
    const provider = await providerRegistry.getOpenAIProvider();
    providerModel = provider(modelId as string);
  } else {
    throw new Error(`Unsupported provider: ${providerId}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdkMessages = messages as any[];

  if (!modelInfo.supportsStreaming) {
    // Non-streaming (e.g., o1)
    const result = await generateText({
      model: providerModel,
      messages: sdkMessages,
      ...(options.system ? { system: options.system } : {}),
    });
    yield { type: 'text', text: result.text };
    yield { type: 'done' };
    return;
  }

  const stream = streamText({
    model: providerModel,
    messages: sdkMessages,
    ...(options.system ? { system: options.system } : {}),
    ...(options.maxTokens ? { maxTokens: options.maxTokens } : {}),
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
  });

  for await (const chunk of stream.textStream) {
    yield { type: 'text', text: chunk };
  }
  yield { type: 'done' };
}
