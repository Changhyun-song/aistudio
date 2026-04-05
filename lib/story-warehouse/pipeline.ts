/**
 * Story Warehouse Pipeline — 4단계: 대량 생성 + 큐레이션
 *
 * 1. 씨앗 5세트 생성 (1단계, AI 없음)
 * 2. 각 씨앗으로 스토리 전제 2개씩 = 10개 (2단계, AI)
 * 3. 10개를 평가해서 3.5점 이상만 필터링 (3단계, AI)
 * 4. 통과한 것만 반환
 */

import { generateSeedBatch, type StorySeed, adjustWeight, type SeedCategory } from './seed-generator';
import { buildPremisesBatch, type StoryPremise } from './premise-builder';
import { evaluateAndFilter, PASS_THRESHOLD, type EvaluatedPremise } from './idea-evaluator';

export interface WarehouseGenerationResult {
  totalSeeds: number;
  totalPremises: number;
  totalEvaluated: number;
  passed: EvaluatedPremise[];
  failed: EvaluatedPremise[];
  seeds: StorySeed[];
}

export interface GenerationProgress {
  stage: 'seeds' | 'premises' | 'evaluating' | 'done';
  current: number;
  total: number;
  message: string;
}

/**
 * 메인 파이프라인: 씨앗 → 전제 → 평가 → 필터링
 */
export async function runWarehousePipeline(
  seedCount: number = 5,
  onProgress?: (p: GenerationProgress) => void,
): Promise<WarehouseGenerationResult> {
  // Step 1: Seed Generation (no AI)
  onProgress?.({ stage: 'seeds', current: 0, total: seedCount, message: `씨앗 ${seedCount}개 조합 중...` });
  const seeds = generateSeedBatch(seedCount);
  onProgress?.({ stage: 'seeds', current: seeds.length, total: seedCount, message: `씨앗 ${seeds.length}개 생성 완료` });

  // Step 2: Premise Building (AI — cheap model)
  const totalPremises = seeds.length * 2;
  onProgress?.({ stage: 'premises', current: 0, total: totalPremises, message: `스토리 전제 생성 중 (0/${seeds.length})...` });

  const allPremises: StoryPremise[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const premises = await buildPremisesBatch([seeds[i]]);
    allPremises.push(...premises);
    onProgress?.({
      stage: 'premises',
      current: allPremises.length,
      total: totalPremises,
      message: `스토리 전제 생성 중 (${i + 1}/${seeds.length})...`,
    });
  }

  // Step 3: Evaluation + Filtering (AI — cheap model, temp=0)
  onProgress?.({ stage: 'evaluating', current: 0, total: allPremises.length, message: `아이디어 평가 중 (0/${allPremises.length})...` });

  const evaluated: EvaluatedPremise[] = [];
  for (let i = 0; i < allPremises.length; i++) {
    const batch = await evaluateAndFilter([allPremises[i]]);
    evaluated.push(...batch);
    onProgress?.({
      stage: 'evaluating',
      current: i + 1,
      total: allPremises.length,
      message: `아이디어 평가 중 (${i + 1}/${allPremises.length})...`,
    });
  }

  const passed = evaluated.filter(e => e.evaluation.verdict === 'pass');
  const failed = evaluated.filter(e => e.evaluation.verdict === 'fail');

  onProgress?.({
    stage: 'done',
    current: passed.length,
    total: evaluated.length,
    message: `완료! ${evaluated.length}개 중 ${passed.length}개 통과 (${PASS_THRESHOLD}점 이상)`,
  });

  return {
    totalSeeds: seeds.length,
    totalPremises: allPremises.length,
    totalEvaluated: evaluated.length,
    passed,
    failed,
    seeds,
  };
}

/**
 * 자가 개선: 사용자가 아이디어를 채택하면 씨앗 가중치를 올린다.
 */
export function recordSelection(premise: EvaluatedPremise, seeds: StorySeed[]): void {
  const seed = seeds.find(s => s.id === premise.seedId);
  if (!seed) return;

  const boost = premise.evaluation.overall >= 4.0 ? 0.3 : 0.15;
  for (const el of seed.elements) {
    adjustWeight(el.category, el.item.id, boost);
  }
}

/**
 * 자가 개선: 사용자가 무시한 아이디어의 씨앗 가중치를 약간 내린다.
 */
export function recordIgnored(premises: EvaluatedPremise[], selectedIds: Set<string>, seeds: StorySeed[]): void {
  for (const p of premises) {
    if (selectedIds.has(p.seedId)) continue;
    const seed = seeds.find(s => s.id === p.seedId);
    if (!seed) continue;
    for (const el of seed.elements) {
      adjustWeight(el.category as SeedCategory, el.item.id, -0.05);
    }
  }
}
