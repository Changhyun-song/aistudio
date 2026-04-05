import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

// ── Config ───────────────────────────────────────────

const GEMINI_API_KEY = () => process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = () => process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// ── Types ────────────────────────────────────────────

export interface GeminiGenerateParams {
  prompt: string;
  referenceImagePath?: string;
  outputDir: string;
  outputFilename: string;
}

export interface GeminiGenerateResult {
  success: boolean;
  filePath: string;
  publicPath: string;
  prompt: string;
  error?: string;
}

// ── Core Generation ──────────────────────────────────

function buildRequestBody(prompt: string, referenceImageBase64?: string, referenceImageMime?: string) {
  const parts: Record<string, unknown>[] = [
    { text: prompt },
  ];

  if (referenceImageBase64 && referenceImageMime) {
    parts.unshift({
      inlineData: {
        mimeType: referenceImageMime,
        data: referenceImageBase64,
      },
    });
  }

  return {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };
}

function readImageAsBase64(imagePath: string): { data: string; mimeType: string } | null {
  const absPath = imagePath.startsWith('/')
    ? path.join(process.cwd(), 'public', imagePath)
    : path.resolve(imagePath);

  if (!fs.existsSync(absPath)) return null;

  const ext = path.extname(absPath).toLowerCase();
  const mimeMap: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
  const mimeType = mimeMap[ext] || 'image/png';
  const data = fs.readFileSync(absPath).toString('base64');
  return { data, mimeType };
}

export async function generateImage(params: GeminiGenerateParams): Promise<GeminiGenerateResult> {
  const { prompt, referenceImagePath, outputDir, outputFilename } = params;

  if (!isGeminiConfigured()) {
    return { success: false, filePath: '', publicPath: '', prompt, error: 'GEMINI_API_KEY not configured' };
  }

  let refData: string | undefined;
  let refMime: string | undefined;
  if (referenceImagePath) {
    const img = readImageAsBase64(referenceImagePath);
    if (img) { refData = img.data; refMime = img.mimeType; }
  }

  const model = GEMINI_MODEL();
  const url = `${API_BASE}/models/${model}:generateContent?key=${GEMINI_API_KEY()}`;
  const body = buildRequestBody(prompt, refData, refMime);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    return { success: false, filePath: '', publicPath: '', prompt, error: `Gemini API ${response.status}: ${errText.slice(0, 300)}` };
  }

  const result = await response.json();

  const candidates = result.candidates;
  if (!candidates || candidates.length === 0) {
    const blockReason = result.promptFeedback?.blockReason;
    return { success: false, filePath: '', publicPath: '', prompt, error: blockReason ? `Blocked: ${blockReason}` : 'No candidates returned' };
  }

  const parts = candidates[0].content?.parts || [];
  const imagePart = parts.find((p: Record<string, unknown>) => p.inlineData);

  if (!imagePart?.inlineData) {
    const textPart = parts.find((p: Record<string, unknown>) => p.text);
    return { success: false, filePath: '', publicPath: '', prompt, error: `No image in response. Text: ${(textPart?.text as string || '').slice(0, 200)}` };
  }

  const imageData = imagePart.inlineData.data as string;
  const mimeType = (imagePart.inlineData.mimeType as string) || 'image/png';
  const ext = mimeType.includes('jpeg') ? '.jpg' : '.png';
  const baseName = outputFilename.replace(/\.(png|jpg|jpeg|webp)$/i, '');
  const filename = `${baseName}${ext}`;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, Buffer.from(imageData, 'base64'));

  const publicDir = path.join(process.cwd(), 'public');
  const relativePath = path.relative(publicDir, filePath).replace(/\\/g, '/');
  const publicPath = relativePath.startsWith('uploads') ? `/${relativePath}` : filePath;

  return { success: true, filePath, publicPath, prompt };
}

// ── Convenience wrappers ─────────────────────────────

export async function generateAnchorShot(
  prompt: string,
  referenceImagePath: string,
  projectFolder: string,
  anchorKey: string,
): Promise<GeminiGenerateResult> {
  const outputDir = path.join(process.cwd(), 'public', 'uploads', projectFolder, 'characterizer', 'anchors');
  return generateImage({ prompt, referenceImagePath, outputDir, outputFilename: `${anchorKey}.png` });
}

export async function generateShotImage(
  prompt: string,
  referenceImagePath: string,
  projectFolder: string,
  shotKey: string,
): Promise<GeminiGenerateResult> {
  const outputDir = path.join(process.cwd(), 'public', 'uploads', projectFolder, 'characterizer', 'shots');
  return generateImage({ prompt, referenceImagePath, outputDir, outputFilename: `${shotKey}.png` });
}
