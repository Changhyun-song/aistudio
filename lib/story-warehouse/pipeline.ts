/**
 * Story Warehouse Pipeline — 4단계 재설계
 *
 * 1. Seed Generator — 소재 씨앗 (AI 없음)
 * 2. Drama Engine — 사건 체인 생성 (AI)
 * 3. Anti-Cliche Filter — 공식 고착 방지
 * 4. Evaluator — 새 기준으로 평가
 */

import { generateSeedBatch, type StorySeed, adjustWeight, type SeedCategory } from './seed-generator';
import { generateDramaBatch, type DramaOutput } from './drama-engine';
import { filterBatch } from './anti-cliche-filter';
import { evaluateAndFilter, DEFAULT_PASS_THRESHOLD, type EvaluatedDrama } from './idea-evaluator';

export interface WarehouseGenerationResult {
  totalSeeds: number;
  totalDramas: number;
  totalEvaluated: number;
  passed: EvaluatedDrama[];
  failed: EvaluatedDrama[];
  seeds: StorySeed[];
  errors: string[];
  clicheFiltered: number;
}

export interface GenerationProgress {
  stage: 'seeds' | 'drama' | 'filter' | 'evaluating' | 'done';
  current: number;
  total: number;
  message: string;
}

export async function runWarehousePipeline(
  seedCount: number = 5,
  passThreshold: number = DEFAULT_PASS_THRESHOLD,
  onProgress?: (p: GenerationProgress) => void,
): Promise<WarehouseGenerationResult> {
  onProgress?.({ stage: 'seeds', current: 0, total: seedCount, message: `씨앗 ${seedCount}개 조합 중...` });
  const seeds = generateSeedBatch(seedCount);
  onProgress?.({ stage: 'seeds', current: seeds.length, total: seedCount, message: `씨앗 ${seeds.length}개 생성 완료` });

  const totalExpected = seeds.length * 2;
  onProgress?.({ stage: 'drama', current: 0, total: totalExpected, message: `사건 체인 생성 중 (0/${seeds.length})...` });

  const allDramas: DramaOutput[] = [];
  const errors: string[] = [];

  for (let i = 0; i < seeds.length; i++) {
    try {
      const dramas = await generateDramaBatch([seeds[i]]);
      allDramas.push(...dramas);
      if (dramas.length === 0) {
        errors.push(`씨앗 ${i + 1}: Drama 생성 결과 없음`);
      }
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`[Pipeline] Drama build failed for seed ${i + 1}:`, msg);
      errors.push(`씨앗 ${i + 1} Drama 생성 실패: ${msg}`);
    }
    onProgress?.({
      stage: 'drama',
      current: allDramas.length,
      total: totalExpected,
      message: `사건 체인 생성 중 (${i + 1}/${seeds.length})... ${allDramas.length}개 생성됨`,
    });
  }

  if (allDramas.length === 0) {
    const errorMsg = errors.length > 0
      ? `모든 Drama 생성에 실패했습니다.\n${errors.join('\n')}`
      : 'Drama 생성 결과가 없습니다. AI API 연결을 확인해주세요.';
    throw new Error(errorMsg);
  }

  onProgress?.({ stage: 'filter', current: 0, total: allDramas.length, message: `공식 고착 필터링 중...` });
  const { passed: filteredDramas, needsRegeneration } = filterBatch(allDramas);
  const clicheFiltered = needsRegeneration.length;

  if (needsRegeneration.length > 0) {
    for (const nr of needsRegeneration) {
      errors.push(`공식 고착 필터: "${nr.drama.title}" — ${nr.reason}`);
    }
  }

  onProgress?.({
    stage: 'filter',
    current: filteredDramas.length,
    total: allDramas.length,
    message: `필터 완료: ${allDramas.length}개 중 ${filteredDramas.length}개 통과 (${clicheFiltered}개 공식 고착 제거)`,
  });

  onProgress?.({ stage: 'evaluating', current: 0, total: filteredDramas.length, message: `평가 중 (0/${filteredDramas.length})...` });

  const evaluated: EvaluatedDrama[] = [];
  for (let i = 0; i < filteredDramas.length; i++) {
    try {
      const batch = await evaluateAndFilter([filteredDramas[i]], passThreshold);
      evaluated.push(...batch);
    } catch (err) {
      console.error(`[Pipeline] Evaluation failed for drama ${i + 1}:`, (err as Error).message);
      errors.push(`"${filteredDramas[i].title}" 평가 실패: ${(err as Error).message}`);
    }
    onProgress?.({
      stage: 'evaluating',
      current: i + 1,
      total: filteredDramas.length,
      message: `평가 중 (${i + 1}/${filteredDramas.length})...`,
    });
  }

  const passed = evaluated.filter(e => e.evaluation.verdict === 'pass');
  const failed = evaluated.filter(e => e.evaluation.verdict === 'fail');

  onProgress?.({
    stage: 'done',
    current: passed.length,
    total: evaluated.length,
    message: `완료! ${evaluated.length}개 중 ${passed.length}개 통과 (${passThreshold}점 이상)`,
  });

  return {
    totalSeeds: seeds.length,
    totalDramas: allDramas.length,
    totalEvaluated: evaluated.length,
    passed,
    failed,
    seeds,
    errors,
    clicheFiltered,
  };
}

export function recordSelection(drama: EvaluatedDrama, seeds: StorySeed[]): void {
  const seed = seeds.find(s => s.id === drama.seedId);
  if (!seed) return;
  const boost = drama.evaluation.overall >= 4.0 ? 0.3 : 0.15;
  for (const el of seed.elements) {
    adjustWeight(el.category, el.item.id, boost);
  }
}

export function recordIgnored(dramas: EvaluatedDrama[], selectedIds: Set<string>, seeds: StorySeed[]): void {
  for (const d of dramas) {
    if (selectedIds.has(d.seedId)) continue;
    const seed = seeds.find(s => s.id === d.seedId);
    if (!seed) continue;
    for (const el of seed.elements) {
      adjustWeight(el.category as SeedCategory, el.item.id, -0.05);
    }
  }
}
