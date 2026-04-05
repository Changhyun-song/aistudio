import type { ImageProvider, ImageGenerationJob } from './types';
import { nanoid } from 'nanoid';

export class DiscordSemiAutoProvider implements ImageProvider {
  name = 'Semi-Auto Discord';
  mode = 'semi_auto_discord' as const;

  async submitJob(prompt: string): Promise<ImageGenerationJob> {
    return {
      id: nanoid(12),
      prompt,
      status: 'pending',
      metadata: {
        instruction: 'Send /imagine command in your private Discord server with Midjourney bot. Paste the message link below when done.',
        discordCommand: `/imagine prompt:${prompt}`,
      },
    };
  }

  async checkStatus(jobId: string): Promise<ImageGenerationJob> {
    return { id: jobId, prompt: '', status: 'pending' };
  }

  async cancelJob(_jobId: string): Promise<void> {}
}
