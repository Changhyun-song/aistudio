export type ProviderMode = 'manual' | 'semi_auto_discord';

export interface ImageGenerationJob {
  id: string;
  prompt: string;
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  resultPath?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ImageProvider {
  name: string;
  mode: ProviderMode;
  submitJob(prompt: string): Promise<ImageGenerationJob>;
  checkStatus(jobId: string): Promise<ImageGenerationJob>;
  cancelJob(jobId: string): Promise<void>;
}
