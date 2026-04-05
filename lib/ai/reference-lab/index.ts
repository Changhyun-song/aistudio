import { getProvider } from '@/lib/ai';
import { getReferenceLabPrompt } from '@/lib/ai/story-studio/load-system-prompt';
import type { ReferenceSource, ReferenceAnalysis } from '@/types';

function extractJson(raw: string): string {
  const m = raw.match(/```json\s*([\s\S]*?)```/);
  if (m) return m[1].trim();
  const braceStart = raw.indexOf('{');
  const bracketStart = raw.indexOf('[');
  const start = braceStart >= 0 ? braceStart : bracketStart;
  if (start >= 0) return raw.slice(start).trim();
  return raw.trim();
}

function safeParseJson(raw: string): Record<string, unknown> {
  try {
    const cleaned = extractJson(raw);
    return JSON.parse(cleaned);
  } catch {
    return { rawText: raw };
  }
}

// ─── Mode 1: source_analysis ───────────────────

export async function analyzeReferenceSource(
  source: ReferenceSource,
): Promise<Record<string, unknown>> {
  const textContent = source.raw_text || source.user_note || '';
  if (!textContent.trim()) {
    throw new Error('분석할 텍스트 콘텐츠가 없습니다. 텍스트나 메모를 추가해주세요.');
  }

  const systemPrompt = getReferenceLabPrompt();

  const userMsg = `## Mode: source_analysis

아래 참고 자료를 분석해서, source_analysis 모드의 출력 구조를 따라 JSON으로 응답해줘.

## Reference Material
- Title: ${source.title}
- Type: ${source.type}
- Tags: ${source.tags_json}

## Content
${textContent.slice(0, 15000)}

${source.source_url ? `Source URL: ${source.source_url}` : ''}
${source.user_note && source.user_note !== textContent ? `\nUser Note: ${source.user_note}` : ''}

반드시 아래 JSON 구조로 응답해줘:
\`\`\`json
{
  "sourceTitle": "",
  "sourceType": "",
  "highLevelSummary": "",
  "genreSignals": [],
  "toneSignals": [],
  "themes": [],
  "protagonistEnsembleType": "",
  "relationshipDynamics": [],
  "mysteryTwistDevices": [],
  "romancePattern": "",
  "visualMotifs": [],
  "pacingNotes": "",
  "emotionalBeats": [],
  "usefulInspirationPoints": [],
  "avoidCopyingNotes": [],
  "recommendedUseInOriginalStory": ""
}
\`\`\``;

  const provider = getProvider();
  const raw = await provider.chat(systemPrompt, userMsg);
  return safeParseJson(raw);
}

// ─── Mode 2: reference_synthesis ───────────────

export async function synthesizeReferences(
  analyses: { source: ReferenceSource; analysis: ReferenceAnalysis }[],
  userGoal?: string,
): Promise<Record<string, unknown>> {
  const systemPrompt = getReferenceLabPrompt();

  const analysesBlock = analyses.map((a, i) => {
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(a.analysis.raw_json); } catch { /* empty */ }
    return `### Source ${i + 1}: ${a.source.title} (${a.source.type})
Tags: ${a.source.tags_json}
Summary: ${String(parsed.highLevelSummary || '')}
Genre: ${String(parsed.genreSignals ? JSON.stringify(parsed.genreSignals) : a.analysis.genre)}
Tone: ${String(parsed.toneSignals ? JSON.stringify(parsed.toneSignals) : a.analysis.tone)}
Themes: ${a.analysis.themes_json}
Character Types: ${a.analysis.character_types_json}
Relationship Dynamics: ${a.analysis.relationship_dynamics_json}
Mystery/Twist: ${a.analysis.mystery_elements_json}
Visual Motifs: ${a.analysis.visual_motifs_json}
Pacing: ${a.analysis.pacing_notes}
Romance: ${a.analysis.romance_pattern}
Twist: ${a.analysis.twist_pattern}
Emotional Beats: ${String(parsed.emotionalBeats ? JSON.stringify(parsed.emotionalBeats) : '[]')}
Inspiration Points: ${String(parsed.usefulInspirationPoints ? JSON.stringify(parsed.usefulInspirationPoints) : '[]')}
Avoid: ${a.analysis.avoid_cliches_json}`;
  }).join('\n\n');

  const userMsg = `## Mode: reference_synthesis

아래 분석 결과들을 종합해서, reference_synthesis 모드의 출력 구조를 따라 JSON으로 응답해줘.

## Reference Analyses (${analyses.length} sources)

${analysesBlock}

${userGoal ? `## User's Creative Goal\n${userGoal}\n` : ''}

반드시 아래 JSON 구조로 응답해줘:
\`\`\`json
{
  "synthesisSummary": "",
  "repeatedPatterns": [],
  "strongestToneDirections": [],
  "strongestCharacterRelationshipPatterns": [],
  "strongestConflictStructures": [],
  "strongestMysteryTwistIdeas": [],
  "strongestVisualMotifs": [],
  "romanceIntegrationIdeas": [],
  "schoolLifeIntegrationIdeas": [],
  "creatureSFInspirationIdeas": [],
  "whatToKeep": [],
  "whatToRemix": [],
  "whatToAvoid": [],
  "originalityWarningPoints": [],
  "recommendedOriginalAngle": "",
  "recommendedStoryDNA": "",
  "recommendedVisualDNA": "",
  "recommendedRelationshipMap": "",
  "recommendedTwistDirection": ""
}
\`\`\``;

  const provider = getProvider();
  const raw = await provider.chat(systemPrompt, userMsg);
  return safeParseJson(raw);
}

// ─── Mode 3: story_input_builder ───────────────

export async function buildStoryInput(
  synthesis: Record<string, unknown>,
  userConcept?: string,
): Promise<Record<string, unknown>> {
  const systemPrompt = getReferenceLabPrompt();

  const userMsg = `## Mode: story_input_builder

아래 synthesis 결과를 Story Architect가 바로 사용할 수 있는 입력으로 변환해줘.

## Synthesis Data
${JSON.stringify(synthesis, null, 2)}

${userConcept ? `## User Concept\n${userConcept}\n` : ''}

반드시 아래 JSON 구조로 응답해줘:
\`\`\`json
{
  "storyConceptSeed": "",
  "genreRecommendation": "",
  "toneRecommendation": "",
  "worldbuildingDirection": "",
  "protagonistTeamDirection": "",
  "conflictRecommendation": "",
  "romanceRecommendation": "",
  "mysteryRecommendation": "",
  "visualSymbolsRecommendation": "",
  "clicheAvoidList": [],
  "promptReadySummary": ""
}
\`\`\``;

  const provider = getProvider();
  const raw = await provider.chat(systemPrompt, userMsg);
  return safeParseJson(raw);
}

// ─── Markdown Builder (for Story Studio prefill) ──

export function buildStoryInputMarkdown(
  storyInput: Record<string, unknown>,
  mode: 'full' | 'tone_visual' | 'character_relationship' | 'mystery_twist' = 'full',
): string {
  const lines: string[] = ['## Reference Inspiration (AI 생성)'];

  if (storyInput.promptReadySummary) {
    lines.push(`\n### Story Architect용 요약\n${storyInput.promptReadySummary}`);
  }

  if (mode === 'full' || mode === 'tone_visual') {
    if (storyInput.toneRecommendation) lines.push(`\n### 톤\n${storyInput.toneRecommendation}`);
    if (storyInput.visualSymbolsRecommendation) lines.push(`\n### 비주얼\n${storyInput.visualSymbolsRecommendation}`);
  }

  if (mode === 'full' || mode === 'character_relationship') {
    if (storyInput.protagonistTeamDirection) lines.push(`\n### 캐릭터/팀\n${storyInput.protagonistTeamDirection}`);
    if (storyInput.romanceRecommendation) lines.push(`\n### 로맨스\n${storyInput.romanceRecommendation}`);
  }

  if (mode === 'full' || mode === 'mystery_twist') {
    if (storyInput.mysteryRecommendation) lines.push(`\n### 미스터리\n${storyInput.mysteryRecommendation}`);
    if (storyInput.conflictRecommendation) lines.push(`\n### 갈등\n${storyInput.conflictRecommendation}`);
  }

  if (mode === 'full') {
    if (storyInput.storyConceptSeed) lines.push(`\n### 컨셉 씨앗\n${storyInput.storyConceptSeed}`);
    if (storyInput.genreRecommendation) lines.push(`\n### 장르\n${storyInput.genreRecommendation}`);
    if (storyInput.worldbuildingDirection) lines.push(`\n### 세계관\n${storyInput.worldbuildingDirection}`);
    if (Array.isArray(storyInput.clicheAvoidList) && storyInput.clicheAvoidList.length > 0) {
      lines.push(`\n### 피할 것\n${(storyInput.clicheAvoidList as string[]).join('\n- ')}`);
    }
  }

  return lines.join('\n');
}
