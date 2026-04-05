/**
 * Seed Generator — 1단계: AI 없이 순수 랜덤 조합으로 스토리 씨앗 생성
 *
 * 가중치 기반 확률 선택: 성공한 패턴은 선택 확률이 올라감.
 * 동적 풀 확장: 외부에서 SeedItem을 추가 가능 (트렌드 분석 등).
 */

import { nanoid } from 'nanoid';
import { DEFAULT_POOLS, type SeedPool, type SeedItem, type SeedCategory, type StorySeed } from './seed-pools';

export type { StorySeed, SeedCategory } from './seed-pools';

let dynamicPools: SeedPool[] = JSON.parse(JSON.stringify(DEFAULT_POOLS));

function weightedRandom(items: SeedItem[]): SeedItem {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * totalWeight;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function pickFromCategory(category: SeedCategory): SeedItem | null {
  const pool = dynamicPools.find(p => p.category === category);
  if (!pool || pool.items.length === 0) return null;
  return weightedRandom(pool.items);
}

/**
 * 하나의 씨앗 세트를 생성한다.
 *
 * 핵심 규칙:
 * - what_if 하나가 이야기의 중심축 (필수)
 * - conflict_type 하나가 갈등의 방향 (필수 — "조직 음모" 고착 방지)
 * - 나머지 0~1개는 중심을 돋보이게 하는 보조 소재
 * - 총 2~3개. 절대 4개 이상 넣지 않는다.
 */
export function generateSeed(elementCount: number = 0): StorySeed {
  const count = elementCount > 0 ? Math.min(elementCount, 3) : (Math.random() < 0.5 ? 2 : 3);

  const elements: { category: SeedCategory; item: SeedItem }[] = [];

  const whatIf = pickFromCategory('what_if');
  if (whatIf) elements.push({ category: 'what_if', item: whatIf });

  const conflictType = pickFromCategory('conflict_type');
  if (conflictType) elements.push({ category: 'conflict_type', item: conflictType });

  const supportCategories: SeedCategory[] = [
    'genre_combo', 'era_setting', 'character_irony',
    'relationship_structure', 'social_theme',
  ];
  const shuffled = [...supportCategories].sort(() => Math.random() - 0.5);

  for (const cat of shuffled) {
    if (elements.length >= count) break;
    const item = pickFromCategory(cat);
    if (item) elements.push({ category: cat, item });
  }

  return {
    id: nanoid(10),
    elements,
    generatedAt: Date.now(),
  };
}

/**
 * 여러 씨앗 세트를 한 번에 생성한다.
 * 중복 방지: 같은 what_if나 character_irony가 두 번 나오지 않게.
 */
export function generateSeedBatch(count: number = 5): StorySeed[] {
  const seeds: StorySeed[] = [];
  const usedWhatIfs = new Set<string>();
  const usedIronies = new Set<string>();

  for (let i = 0; i < count * 3 && seeds.length < count; i++) {
    const seed = generateSeed();

    const whatIf = seed.elements.find(e => e.category === 'what_if');
    const irony = seed.elements.find(e => e.category === 'character_irony');

    if (whatIf && usedWhatIfs.has(whatIf.item.id)) continue;
    if (irony && usedIronies.has(irony.item.id)) continue;

    if (whatIf) usedWhatIfs.add(whatIf.item.id);
    if (irony) usedIronies.add(irony.item.id);

    seeds.push(seed);
  }

  return seeds;
}

/**
 * 특정 카테고리 아이템의 가중치를 업데이트한다.
 * 양수면 강화, 음수면 약화. 최소 0.1, 최대 5.0.
 */
export function adjustWeight(category: SeedCategory, itemId: string, delta: number): void {
  const pool = dynamicPools.find(p => p.category === category);
  if (!pool) return;
  const item = pool.items.find(i => i.id === itemId);
  if (!item) return;
  item.weight = Math.max(0.1, Math.min(5.0, item.weight + delta));
}

/**
 * 새 아이템을 풀에 동적 추가한다. (트렌드 분석 결과 등)
 */
export function addToPool(category: SeedCategory, value: string, source: 'trend' | 'user' = 'trend'): SeedItem {
  const pool = dynamicPools.find(p => p.category === category);
  if (!pool) throw new Error(`Unknown category: ${category}`);

  const item: SeedItem = { id: nanoid(6), value, weight: 1.2, source };
  pool.items.push(item);
  return item;
}

/**
 * 현재 풀 상태를 직렬화 (DB 저장용)
 */
export function serializePools(): string {
  return JSON.stringify(dynamicPools);
}

/**
 * 직렬화된 풀 상태를 복원
 */
export function loadPools(json: string): void {
  try {
    const parsed = JSON.parse(json) as SeedPool[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      dynamicPools = parsed;
    }
  } catch { /* keep defaults */ }
}

export function resetPools(): void {
  dynamicPools = JSON.parse(JSON.stringify(DEFAULT_POOLS));
}

export function getCurrentPools(): SeedPool[] {
  return dynamicPools;
}

/**
 * 씨앗 세트를 사람이 읽기 쉬운 텍스트로 변환
 */
export function seedToReadableText(seed: StorySeed): string {
  return seed.elements
    .map(e => `[${e.category}] ${e.item.value}`)
    .join('\n');
}

/**
 * 씨앗 세트를 AI 프롬프트용 텍스트로 변환
 */
export function seedToPromptText(seed: StorySeed): string {
  const whatIf = seed.elements.find(e => e.category === 'what_if');
  const conflictType = seed.elements.find(e => e.category === 'conflict_type');
  const support = seed.elements.filter(e => e.category !== 'what_if' && e.category !== 'conflict_type');

  const lines: string[] = [];
  if (whatIf) {
    lines.push(`★ 이야기의 핵심 전제 (what-if): ${whatIf.item.value}`);
    lines.push('  → 이 전제가 이야기의 중심축이다. 모든 것은 이 질문에서 시작한다.');
  }
  if (conflictType) {
    lines.push(`\n★★ 갈등의 방향 (반드시 이 유형의 갈등으로 써라):`);
    lines.push(`  ${conflictType.item.value}`);
    lines.push('  → 이 갈등 유형을 벗어나지 마라. 조직/회사/정부의 음모로 대체하지 마라.');
  }
  if (support.length > 0) {
    lines.push(`\n보조 소재 (핵심 전제를 돋보이게 하는 배경/톤):`);
    for (const e of support) {
      const label = e.category === 'genre_combo' ? '장르 톤'
        : e.category === 'era_setting' ? '배경'
        : e.category === 'character_irony' ? '주인공 특성'
        : e.category === 'relationship_structure' ? '관계'
        : '사회적 배경';
      lines.push(`- ${label}: ${e.item.value}`);
    }
  }
  return lines.join('\n');
}
