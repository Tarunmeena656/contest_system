import { config } from '../config';
import { logger } from '../logger';
import { AnthropicProvider } from './anthropic';
import { MockProvider } from './mock';
import { AiProvider } from './types';

let provider: AiProvider | undefined;

export function getAi(): AiProvider {
  if (!provider) {
    if (config.ai.provider === 'anthropic' && config.ai.apiKey) {
      provider = new AnthropicProvider();
    } else {
      if (config.ai.provider === 'anthropic') {
        logger.warn('AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is empty, using the mock provider');
      }
      provider = new MockProvider();
    }
    logger.info({ provider: provider.name, model: config.ai.model }, 'ai provider ready');
  }
  return provider;
}
