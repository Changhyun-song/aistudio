import type { ImageProvider, ProviderMode } from './types';
import { ManualProvider } from './manual';
import { DiscordSemiAutoProvider } from './discord';

const providers: Record<ProviderMode, ImageProvider> = {
  manual: new ManualProvider(),
  semi_auto_discord: new DiscordSemiAutoProvider(),
};

export function getProvider(mode: ProviderMode = 'manual'): ImageProvider {
  return providers[mode];
}

export type { ImageProvider, ImageGenerationJob, ProviderMode } from './types';
