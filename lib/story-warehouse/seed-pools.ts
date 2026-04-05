/**
 * Story Seed Pools — 소재 씨앗 풀
 *
 * 각 카테고리별 소재를 정의하고, 랜덤 조합으로 스토리 씨앗을 생성한다.
 * 이 풀은 트렌드 분석이나 자가 개선을 통해 동적으로 확장 가능하도록 설계됨.
 *
 * 가중치(weight) 시스템:
 * - 기본값 1.0, 성공적인 패턴은 증가, 외면받는 패턴은 감소
 * - 선택 확률은 weight에 비례
 */

export interface SeedItem {
  id: string;
  value: string;
  weight: number;
  source: 'built_in' | 'trend' | 'user';
}

export interface SeedPool {
  category: SeedCategory;
  label: string;
  items: SeedItem[];
}

export type SeedCategory =
  | 'genre_combo'
  | 'era_setting'
  | 'what_if'
  | 'character_irony'
  | 'relationship_structure'
  | 'social_theme';

export interface StorySeed {
  id: string;
  elements: { category: SeedCategory; item: SeedItem }[];
  generatedAt: number;
}

// ── Built-in Pools ──

const GENRE_COMBOS: SeedItem[] = [
  { id: 'gc_01', value: '로맨스 + 스릴러', weight: 1.0, source: 'built_in' },
  { id: 'gc_02', value: 'SF + 가족 드라마', weight: 1.0, source: 'built_in' },
  { id: 'gc_03', value: '학원물 + 미스터리', weight: 1.0, source: 'built_in' },
  { id: 'gc_04', value: '판타지 + 법정 드라마', weight: 1.0, source: 'built_in' },
  { id: 'gc_05', value: '호러 + 로맨스', weight: 1.0, source: 'built_in' },
  { id: 'gc_06', value: '느와르 + 코미디', weight: 1.0, source: 'built_in' },
  { id: 'gc_07', value: '사극 + SF', weight: 1.0, source: 'built_in' },
  { id: 'gc_08', value: '의학 드라마 + 미스터리', weight: 1.0, source: 'built_in' },
  { id: 'gc_09', value: '서바이벌 + 로맨스', weight: 1.0, source: 'built_in' },
  { id: 'gc_10', value: '직장물 + 스릴러', weight: 1.0, source: 'built_in' },
  { id: 'gc_11', value: '다크 판타지 + 성장물', weight: 1.0, source: 'built_in' },
  { id: 'gc_12', value: '타임루프 + 추리', weight: 1.0, source: 'built_in' },
  { id: 'gc_13', value: '뮤지컬 + 범죄', weight: 1.0, source: 'built_in' },
  { id: 'gc_14', value: '묵시록 + 일상물', weight: 1.0, source: 'built_in' },
  { id: 'gc_15', value: '첩보 + 로맨스', weight: 1.0, source: 'built_in' },
  { id: 'gc_16', value: '리벤지 + 가족 드라마', weight: 1.0, source: 'built_in' },
  { id: 'gc_17', value: '초능력 + 학원물', weight: 1.0, source: 'built_in' },
  { id: 'gc_18', value: '요리 + 힐링 + 미스터리', weight: 1.0, source: 'built_in' },
  { id: 'gc_19', value: '우주 + 밀실 스릴러', weight: 1.0, source: 'built_in' },
  { id: 'gc_20', value: '다큐멘터리 형식 + 호러', weight: 1.0, source: 'built_in' },
];

const ERA_SETTINGS: SeedItem[] = [
  { id: 'es_01', value: '현대 서울', weight: 1.0, source: 'built_in' },
  { id: 'es_02', value: '조선시대', weight: 1.0, source: 'built_in' },
  { id: 'es_03', value: '근미래 2040년', weight: 1.0, source: 'built_in' },
  { id: 'es_04', value: '90년대 부산', weight: 1.0, source: 'built_in' },
  { id: 'es_05', value: '80년대 서울 변두리', weight: 1.0, source: 'built_in' },
  { id: 'es_06', value: '일제강점기', weight: 1.0, source: 'built_in' },
  { id: 'es_07', value: '가상의 섬 마을', weight: 1.0, source: 'built_in' },
  { id: 'es_08', value: '2070년 해저 도시', weight: 1.0, source: 'built_in' },
  { id: 'es_09', value: '1970년대 광주', weight: 1.0, source: 'built_in' },
  { id: 'es_10', value: '현대 제주도', weight: 1.0, source: 'built_in' },
  { id: 'es_11', value: '고려시대', weight: 1.0, source: 'built_in' },
  { id: 'es_12', value: '현대 도쿄 (한국인 주인공)', weight: 1.0, source: 'built_in' },
  { id: 'es_13', value: '가상 판타지 왕국', weight: 1.0, source: 'built_in' },
  { id: 'es_14', value: '현대 시골 폐교', weight: 1.0, source: 'built_in' },
  { id: 'es_15', value: '2035년 AI 통치 사회', weight: 1.0, source: 'built_in' },
  { id: 'es_16', value: '6.25 전후 부산', weight: 1.0, source: 'built_in' },
  { id: 'es_17', value: '현대 고시원/원룸촌', weight: 1.0, source: 'built_in' },
  { id: 'es_18', value: '우주 정거장', weight: 1.0, source: 'built_in' },
];

const WHAT_IFS: SeedItem[] = [
  { id: 'wi_01', value: '만약에 기억을 지우는 약이 편의점에서 팔린다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_02', value: '만약에 죽은 사람과 7일간 통화할 수 있다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_03', value: '만약에 모든 거짓말이 얼굴에 표시된다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_04', value: '만약에 꿈이 다른 사람과 연결된다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_05', value: '만약에 감정을 사고팔 수 있다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_06', value: '만약에 하루를 무한 반복할 수 있지만, 반복할 때마다 기억이 조금씩 사라진다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_07', value: '만약에 어떤 건물에 들어가면 10년 전으로 돌아간다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_08', value: '만약에 사람의 수명이 SNS 좋아요 수로 결정된다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_09', value: '만약에 범죄자의 기억을 피해자에게 이식할 수 있다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_10', value: '만약에 자신의 미래를 볼 수 있지만, 볼 때마다 미래가 바뀐다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_11', value: '만약에 사랑하는 사람이 AI인 걸 알게 된다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_12', value: '만약에 세상의 모든 음악이 사라진다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_13', value: '만약에 잠을 자면 다른 사람의 몸으로 깨어난다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_14', value: '만약에 죽음 직전 24시간만 다시 살 수 있는 티켓이 1장 있다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_15', value: '만약에 동물과 대화할 수 있지만, 그 대가로 인간의 언어를 잃어간다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_16', value: '만약에 죄책감이 물리적 무게로 느껴진다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_17', value: '만약에 도시 전체가 하나의 거대한 게임 속이라면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_18', value: '만약에 눈물을 흘리면 비가 내린다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_19', value: '만약에 유서에 쓴 내용이 반드시 실현된다면?', weight: 1.0, source: 'built_in' },
  { id: 'wi_20', value: '만약에 꿈에서 만난 사람을 현실에서 찾을 수 있다면?', weight: 1.0, source: 'built_in' },
];

const CHARACTER_IRONIES: SeedItem[] = [
  { id: 'ci_01', value: '사기꾼인데 병적으로 정직한', weight: 1.0, source: 'built_in' },
  { id: 'ci_02', value: '장의사인데 죽음이 무서운', weight: 1.0, source: 'built_in' },
  { id: 'ci_03', value: '심리상담사인데 본인이 공황장애', weight: 1.0, source: 'built_in' },
  { id: 'ci_04', value: '경호원인데 폭력 트라우마가 있는', weight: 1.0, source: 'built_in' },
  { id: 'ci_05', value: '요리사인데 미각을 잃은', weight: 1.0, source: 'built_in' },
  { id: 'ci_06', value: '판사인데 과거 전과가 있는', weight: 1.0, source: 'built_in' },
  { id: 'ci_07', value: '소방관인데 불에 대한 트라우마가 있는', weight: 1.0, source: 'built_in' },
  { id: 'ci_08', value: '이혼 전문 변호사인데 사랑을 갈구하는', weight: 1.0, source: 'built_in' },
  { id: 'ci_09', value: '인플루언서인데 극도로 내성적인', weight: 1.0, source: 'built_in' },
  { id: 'ci_10', value: '탐정인데 얼굴을 기억 못하는 (안면인식장애)', weight: 1.0, source: 'built_in' },
  { id: 'ci_11', value: '외과의사인데 손이 떨리는', weight: 1.0, source: 'built_in' },
  { id: 'ci_12', value: '운동선수인데 통증을 못 느끼는', weight: 1.0, source: 'built_in' },
  { id: 'ci_13', value: '뉴스 앵커인데 말더듬이인', weight: 1.0, source: 'built_in' },
  { id: 'ci_14', value: '음악 프로듀서인데 청각을 잃어가는', weight: 1.0, source: 'built_in' },
  { id: 'ci_15', value: '사형집행인인데 극도로 감성적인', weight: 1.0, source: 'built_in' },
  { id: 'ci_16', value: '점쟁이인데 자기 미래만 못 보는', weight: 1.0, source: 'built_in' },
  { id: 'ci_17', value: 'AI 윤리학자인데 AI와 사랑에 빠진', weight: 1.0, source: 'built_in' },
  { id: 'ci_18', value: '유전공학자인데 자녀가 희귀병인', weight: 1.0, source: 'built_in' },
];

const RELATIONSHIP_STRUCTURES: SeedItem[] = [
  { id: 'rs_01', value: '삼각관계 — 친구 사이에서', weight: 1.0, source: 'built_in' },
  { id: 'rs_02', value: '쌍둥이 바꿔치기', weight: 1.0, source: 'built_in' },
  { id: 'rs_03', value: '원수 가문의 자녀들', weight: 1.0, source: 'built_in' },
  { id: 'rs_04', value: '시간차 만남 (과거와 현재)', weight: 1.0, source: 'built_in' },
  { id: 'rs_05', value: '가해자-피해자 재회', weight: 1.0, source: 'built_in' },
  { id: 'rs_06', value: '기억을 잃은 연인', weight: 1.0, source: 'built_in' },
  { id: 'rs_07', value: '스승과 제자의 역전', weight: 1.0, source: 'built_in' },
  { id: 'rs_08', value: '가짜 부부/커플', weight: 1.0, source: 'built_in' },
  { id: 'rs_09', value: '서로 모르는 형제/자매', weight: 1.0, source: 'built_in' },
  { id: 'rs_10', value: '라이벌이 같은 목표를 가진', weight: 1.0, source: 'built_in' },
  { id: 'rs_11', value: '구원자와 구원받는 자의 위치 역전', weight: 1.0, source: 'built_in' },
  { id: 'rs_12', value: '익명의 온라인 관계가 현실에서 적', weight: 1.0, source: 'built_in' },
  { id: 'rs_13', value: '세대 간 비밀 (조부모-손주)', weight: 1.0, source: 'built_in' },
  { id: 'rs_14', value: '계약 관계 (결혼/동거/파트너십)', weight: 1.0, source: 'built_in' },
  { id: 'rs_15', value: '같은 사람을 다른 시간대에 만남', weight: 1.0, source: 'built_in' },
];

const SOCIAL_THEMES: SeedItem[] = [
  { id: 'st_01', value: '젠트리피케이션과 원주민 쫓김', weight: 1.0, source: 'built_in' },
  { id: 'st_02', value: 'AI가 인간 일자리를 대체하는 사회', weight: 1.0, source: 'built_in' },
  { id: 'st_03', value: '초고령화 사회의 그림자', weight: 1.0, source: 'built_in' },
  { id: 'st_04', value: 'SNS 중독과 디지털 페르소나', weight: 1.0, source: 'built_in' },
  { id: 'st_05', value: '학력/학벌 차별', weight: 1.0, source: 'built_in' },
  { id: 'st_06', value: '기후 위기와 환경 난민', weight: 1.0, source: 'built_in' },
  { id: 'st_07', value: '감시 사회와 프라이버시', weight: 1.0, source: 'built_in' },
  { id: 'st_08', value: '가족 해체와 1인 가구', weight: 1.0, source: 'built_in' },
  { id: 'st_09', value: '부의 양극화와 계층 이동 불가', weight: 1.0, source: 'built_in' },
  { id: 'st_10', value: '가짜뉴스와 진실의 붕괴', weight: 1.0, source: 'built_in' },
  { id: 'st_11', value: '메타버스 세계에서의 정체성', weight: 1.0, source: 'built_in' },
  { id: 'st_12', value: '정신건강 낙인과 치료 접근성', weight: 1.0, source: 'built_in' },
  { id: 'st_13', value: '성형/외모지상주의', weight: 1.0, source: 'built_in' },
  { id: 'st_14', value: '입시/경쟁 사회의 피로', weight: 1.0, source: 'built_in' },
  { id: 'st_15', value: '디지털 유산과 사후 데이터', weight: 1.0, source: 'built_in' },
];

export const DEFAULT_POOLS: SeedPool[] = [
  { category: 'genre_combo', label: '장르 조합', items: GENRE_COMBOS },
  { category: 'era_setting', label: '시대/배경', items: ERA_SETTINGS },
  { category: 'what_if', label: '"만약에" 전제', items: WHAT_IFS },
  { category: 'character_irony', label: '캐릭터 아이러니', items: CHARACTER_IRONIES },
  { category: 'relationship_structure', label: '관계 구조', items: RELATIONSHIP_STRUCTURES },
  { category: 'social_theme', label: '사회적 소재', items: SOCIAL_THEMES },
];

export const CATEGORY_LABELS: Record<SeedCategory, string> = {
  genre_combo: '장르 조합',
  era_setting: '시대/배경',
  what_if: '"만약에" 전제',
  character_irony: '캐릭터 아이러니',
  relationship_structure: '관계 구조',
  social_theme: '사회적 소재',
};
