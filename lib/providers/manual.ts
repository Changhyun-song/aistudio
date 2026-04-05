import type { ImageProvider, ImageGenerationJob } from './types';
import { nanoid } from 'nanoid';

export class ManualProvider implements ImageProvider {
  name = 'Manual (Copy & Paste)';
  mode = 'manual' as const;

  async submitJob(prompt: string): Promise<ImageGenerationJob> {
    return {
      id: nanoid(12),
      prompt,
      status: 'pending',
      metadata: {
        instruction: 'Copy the prompt to Midjourney Web Create page or Discord, then upload the result image back here.',
      },
    };
  }

  async checkStatus(jobId: string): Promise<ImageGenerationJob> {
    return {
      id: jobId,
      prompt: '',
      status: 'pending',
    };
  }

  async cancelJob(_jobId: string): Promise<void> {
    // no-op for manual mode
  }
}
