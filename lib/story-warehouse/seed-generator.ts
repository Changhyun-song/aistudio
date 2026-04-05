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
 * 6개 카테고리 중 3~5개를 랜덤으로 선택하여 조합.
 */
export function generateSeed(elementCount: number = 0): StorySeed {
  const allCategories: SeedCategory[] = [
    'genre_combo', 'era_setting', 'what_if',
    'character_irony', 'relationship_structure', 'social_theme',
  ];

  const count = elementCount > 0
    ? Math.min(elementCount, allCategories.length)
    : 3 + Math.floor(Math.random() * 3); // 3~5

  const shuffled = [...allCategories].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  // what_if는 스토리의 핵심이므로 70% 확률로 포함
  if (!selected.includes('what_if') && Math.random() < 0.7) {
    selected[selected.length - 1] = 'what_if';
  }

  // genre_combo는 기본 뼈대이므로 80% 확률로 포함
  if (!selected.includes('genre_combo') && Math.random() < 0.8) {
    selected[0] = 'genre_combo';
  }

  const elements = selected.map(category => {
    const item = pickFromCategory(category);
    return item ? { category, item } : null;
  }).filter((e): e is NonNullable<typeof e> => e !== null);

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
  const parts = seed.elements.map(e => {
    switch (e.category) {
      case 'genre_combo': return `장르: ${e.item.value}`;
      case 'era_setting': return `배경: ${e.item.value}`;
      case 'what_if': return `핵심 전제: ${e.item.value}`;
      case 'character_irony': return `주인공 특성: ${e.item.value}`;
      case 'relationship_structure': return `관계 구조: ${e.item.value}`;
      case 'social_theme': return `사회적 테마: ${e.item.value}`;
    }
  });
  return parts.join('\n');
}
