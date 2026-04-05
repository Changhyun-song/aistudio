/**
 * Anti-Cliche Filter — 3단계: 공식 고착 방지
 *
 * "금지"가 아니라 "기본값 방지"다.
 * 조직 음모 자체가 나쁜 게 아니라, AI가 모든 소재에 자동으로 붙이는 게 문제.
 *
 * 규칙:
 * - 배치 내에서 최대 1개만 조직/시스템 갈등 허용
 * - 나머지는 반드시 다른 종류의 갈등 (관계, 내면, 상황, 도덕, 성장)
 * - 패턴 감지 시 "이 소재에서 조직 음모 없이도 성립하는가" 검증
 */

import type { DramaOutput } from './drama-engine';

const FORMULA_KEYWORDS = [
  '은폐', '내부 세력', '조직', '추적', '데이터 조작', '불법',
  '내부 고발', '권력자', '시스템이 감시', '진실을 밝히',
  '비밀을 숨기', '음모', '체제', '통제 시스템', '기관',
  '정부가', '회사가', '비밀 프로젝트', '배후', '음모론',
  '세력이 방해', '거대한 적', '시스템에 저항', '조직에 맞서',
];

const FORMULA_PATTERNS = [
  /(?:회사|조직|정부|기관|기업|시스템|권력|체제).{0,20}(?:맞서|저항|대항|싸우|투쟁|폭로|밝히|은폐|숨기|감추)/,
  /(?:은폐|조작|감추|숨기).{0,20}(?:진실|비밀|실체|증거)/,
  /(?:내부|비밀).{0,10}(?:세력|조직|그룹|집단)/,
  /(?:추적|감시|방해|통제).{0,10}(?:당하|받으|시작)/,
];

export interface ClicheCheckResult {
  isFormula: boolean;
  formulaScore: number;
  matchedKeywords: string[];
  reason: string;
}

export function checkForFormula(drama: DramaOutput): ClicheCheckResult {
  const allText = [
    drama.protagonist.desire,
    drama.protagonist.flaw,
    ...drama.event_chain.map(e => e.event),
    drama.why_this_premise_matters,
  ].join(' ').toLowerCase();

  const matchedKeywords = FORMULA_KEYWORDS.filter(kw => allText.includes(kw));

  const patternMatches = FORMULA_PATTERNS.filter(pat => pat.test(allText));

  let formulaScore = 0;
  formulaScore += matchedKeywords.length * 0.5;
  formulaScore += patternMatches.length * 1.0;

  const desireIsGeneric = /진실|밝히|폭로|저항|맞서|바꾸/.test(drama.protagonist.desire);
  if (desireIsGeneric) formulaScore += 2;

  const isFormula = formulaScore >= 2;

  let reason = '';
  if (isFormula) {
    if (desireIsGeneric) {
      reason = `주인공의 desire가 공식적 ("${drama.protagonist.desire.slice(0, 30)}")`;
    } else if (matchedKeywords.length > 0) {
      reason = `조직 음모 키워드 감지: ${matchedKeywords.slice(0, 3).join(', ')}`;
    } else {
      reason = `체제 vs 개인 패턴 감지`;
    }
  }

  return { isFormula, formulaScore, matchedKeywords, reason };
}

/**
 * 배치 필터링: 최대 1개만 조직/시스템 갈등 허용
 * 나머지가 공식이면 태그를 붙여서 재생성 대상으로 표시
 */
export function filterBatch(dramas: DramaOutput[]): {
  passed: DramaOutput[];
  needsRegeneration: { drama: DramaOutput; reason: string }[];
} {
  const checks = dramas.map(d => ({ drama: d, check: checkForFormula(d) }));

  const nonFormula = checks.filter(c => !c.check.isFormula);
  const formula = checks.filter(c => c.check.isFormula);

  const passed = [...nonFormula.map(c => c.drama)];
  const needsRegeneration: { drama: DramaOutput; reason: string }[] = [];

  if (formula.length > 0) {
    const bestFormula = formula.sort((a, b) => a.check.formulaScore - b.check.formulaScore);
    passed.push(bestFormula[0].drama);
    for (let i = 1; i < bestFormula.length; i++) {
      needsRegeneration.push({
        drama: bestFormula[i].drama,
        reason: bestFormula[i].check.reason,
      });
    }
  }

  return { passed, needsRegeneration };
}

/**
 * 단일 드라마의 "소재 필수성" 판단
 * event_chain에서 소재(premise)를 빼도 이야기가 성립하면 감점 대상
 */
export function checkPremiseNecessity(drama: DramaOutput): boolean {
  const premiseWords = drama.premise
    .replace(/[^가-힣a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 2);

  if (premiseWords.length === 0) return false;

  let premiseReferences = 0;
  for (const e of drama.event_chain) {
    const text = e.event.toLowerCase();
    if (premiseWords.some(w => text.includes(w.toLowerCase()))) {
      premiseReferences++;
    }
  }

  return premiseReferences >= Math.min(3, drama.event_chain.length * 0.4);
}
