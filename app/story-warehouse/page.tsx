'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useWarehouseStore } from '@/lib/store/warehouse-store';
import Link from 'next/link';

interface WarehouseItem {
  id: string;
  title: string;
  logline: string;
  genre: string;
  tone: string;
  hook: string;
  target_audience: string;
  tags: string;
  source: string;
  status: string;
  project_id: string | null;
  synopsis: string;
  inner_conflict: string;
  outer_obstacle: string;
  expected_episodes: string;
  eval_clarity: number;
  eval_narrative_flow: number;
  eval_focus: number;
  eval_freshness: number;
  eval_conflict: number;
  eval_empathy: number;
  eval_visual: number;
  eval_expandability: number;
  eval_overall: number;
  eval_verdict: string;
  eval_summary: string;
  seed_json: string;
  raw_json: string;
  pick_count: number;
  created_at: string;
}

interface EventBeat {
  beat: string;
  event: string;
  emotion: string;
}

interface DramaRawData {
  protagonist?: { name: string; desire: string; flaw: string };
  event_chain?: EventBeat[];
  why_this_premise_matters?: string;
  premise?: string;
  strengths?: string[];
  weaknesses?: string[];
  formulaPenalty?: number;
  beatTemplate?: string;
  endingType?: string;
  naturalness?: number;
  keyRelationship?: { person: string; bond: string; tension: string };
  smallMoment?: string;
}

const TEMPLATE_LABELS: Record<string, string> = {
  loss: '상실형', discovery: '발견형', growth: '성장형',
  reversal: '반전형', dilemma: '딜레마형',
};
const TEMPLATE_COLORS: Record<string, string> = {
  loss: 'border-pink-500/40 text-pink-400',
  discovery: 'border-blue-500/40 text-blue-400',
  growth: 'border-emerald-500/40 text-emerald-400',
  reversal: 'border-amber-500/40 text-amber-400',
  dilemma: 'border-purple-500/40 text-purple-400',
};
const ENDING_LABELS: Record<string, string> = {
  confession: '고백/결단', silence: '침묵', departure: '떠남',
  waiting: '기다림', acceptance: '수용', repetition: '반복',
  refusal: '거부', surrender: '포기',
};

const BEAT_COLORS: Record<string, string> = {
  // 상실형
  '일상': 'border-l-blue-400 bg-blue-500/5',
  '일상+미련': 'border-l-blue-400 bg-blue-500/5',
  '촉발': 'border-l-amber-400 bg-amber-500/5',
  '첫 행동': 'border-l-emerald-400 bg-emerald-500/5',
  '붙잡기': 'border-l-emerald-400 bg-emerald-500/5',
  '예상 밖 발견': 'border-l-purple-400 bg-purple-500/5',
  '숨기기': 'border-l-purple-400 bg-purple-500/5',
  '잘못된 선택': 'border-l-orange-400 bg-orange-500/5',
  '균열': 'border-l-orange-400 bg-orange-500/5',
  '대가': 'border-l-red-400 bg-red-500/5',
  '들킴': 'border-l-red-400 bg-red-500/5',
  '진실 노출': 'border-l-pink-400 bg-pink-500/5',
  '놓아주기': 'border-l-pink-400 bg-pink-500/5',
  '최종 선택': 'border-l-cyan-400 bg-cyan-500/5',
  // 발견형
  '무지의 일상': 'border-l-blue-400 bg-blue-500/5',
  '이상한 단서': 'border-l-amber-400 bg-amber-500/5',
  '첫 추적': 'border-l-emerald-400 bg-emerald-500/5',
  '예상 밖 증인': 'border-l-purple-400 bg-purple-500/5',
  '잘못된 확신': 'border-l-orange-400 bg-orange-500/5',
  '뒤집히는 증거': 'border-l-red-400 bg-red-500/5',
  '진짜 진실': 'border-l-pink-400 bg-pink-500/5',
  '진실 후의 선택': 'border-l-cyan-400 bg-cyan-500/5',
  // 성장형
  '결핍의 일상': 'border-l-blue-400 bg-blue-500/5',
  '도전 기회': 'border-l-amber-400 bg-amber-500/5',
  '첫 시도+실패': 'border-l-emerald-400 bg-emerald-500/5',
  '뜻밖의 조력': 'border-l-purple-400 bg-purple-500/5',
  '진짜 벽': 'border-l-orange-400 bg-orange-500/5',
  '포기의 순간': 'border-l-red-400 bg-red-500/5',
  '깨달음': 'border-l-pink-400 bg-pink-500/5',
  '다시 도전': 'border-l-cyan-400 bg-cyan-500/5',
  // 반전형
  '확신의 일상': 'border-l-blue-400 bg-blue-500/5',
  '신뢰 강화': 'border-l-amber-400 bg-amber-500/5',
  '미세한 균열': 'border-l-emerald-400 bg-emerald-500/5',
  '의심의 시작': 'border-l-purple-400 bg-purple-500/5',
  '결정적 장면': 'border-l-orange-400 bg-orange-500/5',
  '세계 뒤집힘': 'border-l-red-400 bg-red-500/5',
  '재구성': 'border-l-pink-400 bg-pink-500/5',
  '새로운 선택': 'border-l-cyan-400 bg-cyan-500/5',
  // 딜레마형
  '평범한 일상': 'border-l-blue-400 bg-blue-500/5',
  '두 갈래 등장': 'border-l-amber-400 bg-amber-500/5',
  '한쪽 선택': 'border-l-emerald-400 bg-emerald-500/5',
  '선택의 보상': 'border-l-purple-400 bg-purple-500/5',
  '다른 쪽의 대가': 'border-l-orange-400 bg-orange-500/5',
  '되돌릴 수 없음': 'border-l-red-400 bg-red-500/5',
  '양쪽 모두 위기': 'border-l-pink-400 bg-pink-500/5',
  '최종 결단': 'border-l-cyan-400 bg-cyan-500/5',
};

const BEAT_EMOJIS: Record<string, string> = {
  // 상실형 (기본)
  '일상': '🌅', '일상+미련': '🌅', '촉발': '⚡', '첫 행동': '🏃',
  '붙잡기': '🏃', '예상 밖 발견': '💡', '숨기기': '🤫',
  '잘못된 선택': '💔', '균열': '💔', '대가': '🔥', '들킴': '👁',
  '진실 노출': '👁', '놓아주기': '🕊', '최종 선택': '🎯',
  // 발견형
  '무지의 일상': '😶', '이상한 단서': '🔍', '첫 추적': '🏃',
  '예상 밖 증인': '💡', '잘못된 확신': '💔', '뒤집히는 증거': '🔥',
  '진짜 진실': '👁', '진실 후의 선택': '🎯',
  // 성장형
  '결핍의 일상': '😔', '도전 기회': '⚡', '첫 시도+실패': '💫',
  '뜻밖의 조력': '🤝', '진짜 벽': '🧱', '포기의 순간': '😢',
  '깨달음': '💡', '다시 도전': '🏃',
  // 반전형
  '확신의 일상': '😊', '신뢰 강화': '🤝', '미세한 균열': '🔍',
  '의심의 시작': '🤨', '결정적 장면': '⚡', '세계 뒤집힘': '🌪',
  '재구성': '🧩', '새로운 선택': '🎯',
  // 딜레마형
  '평범한 일상': '🌅', '두 갈래 등장': '🔀', '한쪽 선택': '👉',
  '선택의 보상': '✨', '다른 쪽의 대가': '💔', '되돌릴 수 없음': '🚫',
  '양쪽 모두 위기': '🔥', '최종 결단': '🎯',
};

function scoreColor(v: number) {
  if (v >= 4) return 'text-emerald-400';
  if (v >= 3) return 'text-yellow-400';
  return 'text-red-400';
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min((value / 5) * 100, 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${value >= 4 ? 'bg-emerald-500' : value >= 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-6 text-right font-mono ${scoreColor(value)}`}>{value.toFixed(1)}</span>
    </div>
  );
}

function SeedBadges({ seedJson }: { seedJson: string }) {
  try {
    const seed = JSON.parse(seedJson);
    if (!seed.elements || !Array.isArray(seed.elements)) return null;
    const catLabels: Record<string, string> = {
      genre_combo: '장르', era_setting: '배경', what_if: '전제',
      character_irony: '캐릭터', relationship_structure: '관계',
      social_theme: '사회', conflict_type: '갈등',
    };
    const catColors: Record<string, string> = {
      genre_combo: 'border-purple-500/40 text-purple-400',
      era_setting: 'border-blue-500/40 text-blue-400',
      what_if: 'border-emerald-500/40 text-emerald-400',
      character_irony: 'border-orange-500/40 text-orange-400',
      relationship_structure: 'border-pink-500/40 text-pink-400',
      social_theme: 'border-cyan-500/40 text-cyan-400',
      conflict_type: 'border-rose-500/40 text-rose-400',
    };
    return (
      <div className="flex flex-wrap gap-1">
        {seed.elements.map((e: { category: string; item: { value: string } }, i: number) => (
          <Badge key={i} variant="outline" className={`text-[9px] ${catColors[e.category] || ''}`}>
            {catLabels[e.category] || e.category}: {e.item.value.length > 30 ? e.item.value.slice(0, 30) + '…' : e.item.value}
          </Badge>
        ))}
      </div>
    );
  } catch { return null; }
}

function EventChainDisplay({ events }: { events: EventBeat[] }) {
  return (
    <div className="space-y-1.5">
      {events.map((e, i) => (
        <div key={i} className={`border-l-2 pl-3 py-1.5 rounded-r ${BEAT_COLORS[e.beat] || 'border-l-zinc-500 bg-zinc-800/30'}`}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm">{BEAT_EMOJIS[e.beat] || '▸'}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{e.beat}</span>
            <span className="text-[10px] text-zinc-500 ml-auto">{e.emotion}</span>
          </div>
          <p className="text-xs leading-relaxed">{e.event}</p>
        </div>
      ))}
    </div>
  );
}

export default function StoryWarehousePage() {
  const router = useRouter();
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualLogline, setManualLogline] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [filterSource, setFilterSource] = useState<'all' | 'pipeline' | 'manual'>('all');
  const [passThreshold, setPassThreshold] = useState(3.8);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteScoreThreshold, setDeleteScoreThreshold] = useState(4.0);
  const [deleting, setDeleting] = useState(false);

  const { generating, stageLabel, stats, error: genError, lastGeneratedAt, runGeneration, checkStatus } = useWarehouseStore();

  const fetchItems = useCallback(async () => {
    const url = search ? `/api/story-warehouse?q=${encodeURIComponent(search)}` : '/api/story-warehouse';
    const res = await fetch(url);
    if (res.ok) setItems(await res.json());
  }, [search]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (lastGeneratedAt) fetchItems();
  }, [lastGeneratedAt, fetchItems]);

  const handleGenerate = () => { runGeneration(5, passThreshold); };

  const handleManualAdd = async () => {
    if (!manualTitle.trim()) return;
    await fetch('/api/story-warehouse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: manualTitle, logline: manualLogline, source: 'manual' }),
    });
    setManualTitle('');
    setManualLogline('');
    setShowAdd(false);
    fetchItems();
  };

  const handleExportTxt = () => {
    window.open('/api/story-warehouse?format=txt', '_blank');
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/story-warehouse/${id}`, { method: 'DELETE' });
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    fetchItems();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(i => i.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개 스토리를 삭제하시겠습니까?`)) return;
    setDeleting(true);
    await fetch('/api/story-warehouse', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_many', ids: Array.from(selectedIds) }),
    });
    setSelectedIds(new Set());
    setDeleting(false);
    fetchItems();
  };

  const handleDeleteAll = async () => {
    if (!confirm(`전체 ${items.length}개 스토리를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    setDeleting(true);
    await fetch('/api/story-warehouse', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_all' }),
    });
    setSelectedIds(new Set());
    setDeleting(false);
    fetchItems();
  };

  const handleDeleteBelowScore = async () => {
    const belowCount = items.filter(i => i.eval_overall > 0 && i.eval_overall < deleteScoreThreshold).length;
    if (belowCount === 0) { alert(`${deleteScoreThreshold.toFixed(1)}점 미만 스토리가 없습니다.`); return; }
    if (!confirm(`${deleteScoreThreshold.toFixed(1)}점 미만 ${belowCount}개 스토리를 삭제하시겠습니까?`)) return;
    setDeleting(true);
    await fetch('/api/story-warehouse', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_below_score', threshold: deleteScoreThreshold }),
    });
    setSelectedIds(new Set());
    setDeleting(false);
    fetchItems();
  };

  const handleUseIdea = async (item: WarehouseItem) => {
    fetch('/api/story-warehouse/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'record_pick', itemId: item.id }),
    }).catch(() => {});

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: item.title,
        description: item.logline,
        mode: 'story_studio',
      }),
    });
    if (res.ok) {
      const project = await res.json();
      router.push(`/projects/${project.id}/story-studio`);
    }
  };

  const parseRawData = (rawJson: string): DramaRawData | null => {
    try { return JSON.parse(rawJson); } catch { return null; }
  };

  const filtered = items
    .filter(item => filterSource === 'all' || item.source === filterSource)
    .sort((a, b) => {
      if (sortBy === 'score') return (b.eval_overall || 0) - (a.eval_overall || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const pipelineItems = items.filter(i => i.source === 'pipeline');
  const avgScore = pipelineItems.length > 0
    ? pipelineItems.reduce((s, i) => s + (i.eval_overall || 0), 0) / pipelineItems.length
    : 0;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/projects" className="text-muted-foreground hover:text-foreground text-sm">← Projects</Link>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Story Warehouse</h1>
              <p className="text-xs text-muted-foreground">Seed → Drama Engine → Anti-Cliche → Evaluator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportTxt} disabled={items.length === 0}>TXT 저장</Button>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>+ 수동 추가</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <h2 className="text-sm font-semibold text-emerald-400">Drama Pipeline v2</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  1. 소재 씨앗 5세트 랜덤 조합 →
                  2. Drama Engine이 주인공 + 사건 체인 생성 (10개) →
                  3. Anti-Cliche Filter로 공식 고착 제거 →
                  4. 보고 싶은가/캐릭터 호감/관계 중심/자연스러움/소재↔관계 평가
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <Label className="text-xs text-muted-foreground shrink-0">커트라인</Label>
                  <input
                    type="range" min={2.0} max={5.0} step={0.1}
                    value={passThreshold}
                    onChange={e => setPassThreshold(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 accent-emerald-500"
                    disabled={generating}
                  />
                  <span className="text-sm font-mono font-bold text-emerald-400 w-10 text-right">{passThreshold.toFixed(1)}</span>
                  <span className="text-[10px] text-muted-foreground">/5</span>
                </div>
                {stats && stats.totalDramas > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    커트라인 {passThreshold.toFixed(1)} — 생성된 {stats.totalDramas}개 중 {stats.passedCount}개 통과
                    <span className={`font-bold ml-1 ${stats.passedCount / stats.totalDramas >= 0.8 ? 'text-yellow-400' : stats.passedCount / stats.totalDramas >= 0.5 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ({Math.round((stats.passedCount / stats.totalDramas) * 100)}%)
                    </span>
                    {stats.passedCount / stats.totalDramas >= 0.8 && ' — 커트라인을 올려보세요'}
                  </p>
                )}
                {genError && (
                  <div className="mt-2 p-3 rounded bg-red-500/10 border border-red-500/30">
                    <p className="text-xs font-medium text-red-400 mb-1">오류 발생</p>
                    <pre className="text-[10px] text-red-300/80 whitespace-pre-wrap">{genError}</pre>
                  </div>
                )}
                {stats && (
                  <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground mt-2 p-2 rounded bg-zinc-900/50">
                    <span>씨앗: {stats.totalSeeds}세트</span>
                    <span>Drama: {stats.totalDramas}개</span>
                    {stats.clicheFiltered > 0 && <span className="text-orange-400">공식 필터: {stats.clicheFiltered}개 제거</span>}
                    <span className="text-emerald-400">통과: {stats.passedCount}개</span>
                    <span className="text-red-400">탈락: {stats.failedCount}개</span>
                    {stats.failedPreviews?.length > 0 && (
                      <span className="block w-full mt-1 text-zinc-500">
                        탈락 예시: {stats.failedPreviews.map(f => `"${f.title}" (${f.score}점: ${f.reason})`).join(' / ')}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-emerald-600 hover:bg-emerald-700 shrink-0 h-12 px-6"
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                    생성 중...
                  </span>
                ) : '스토리 생성'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {showAdd && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <Input value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="아이디어 제목" />
              <Textarea value={manualLogline} onChange={e => setManualLogline(e.target.value)} placeholder="로그라인 / 아이디어 설명" rows={2} />
              <Button onClick={handleManualAdd} disabled={!manualTitle.trim()} size="sm">추가</Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색..." className="w-60 h-8 text-sm" />
              <div className="flex gap-1">
                {(['all', 'pipeline', 'manual'] as const).map(f => (
                  <Button key={f} variant={filterSource === f ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setFilterSource(f)}>
                    {f === 'all' ? '전체' : f === 'pipeline' ? 'Drama Pipeline' : '수동'}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {pipelineItems.length > 0 && <span>평균: <span className={scoreColor(avgScore)}>{avgScore.toFixed(1)}/5</span></span>}
              <span>{filtered.length}개</span>
              <div className="flex gap-1">
                <Button variant={sortBy === 'date' ? 'default' : 'outline'} size="sm" className="h-6 text-[10px]" onClick={() => setSortBy('date')}>최신순</Button>
                <Button variant={sortBy === 'score' ? 'default' : 'outline'} size="sm" className="h-6 text-[10px]" onClick={() => setSortBy('score')}>점수순</Button>
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-700/50">
              <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 accent-emerald-500 rounded"
                />
                <span className="text-xs text-muted-foreground">전체 선택</span>
              </label>

              {selectedIds.size > 0 && (
                <>
                  <span className="text-[10px] text-emerald-400 font-medium">{selectedIds.size}개 선택됨</span>
                  <div className="h-4 w-px bg-zinc-700" />
                  <Button
                    variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={handleDeleteSelected} disabled={deleting}
                  >
                    선택 삭제
                  </Button>
                </>
              )}

              <div className="h-4 w-px bg-zinc-700" />

              <div className="flex items-center gap-1.5">
                <input
                  type="range" min={3.0} max={5.0} step={0.1}
                  value={deleteScoreThreshold}
                  onChange={e => setDeleteScoreThreshold(parseFloat(e.target.value))}
                  className="w-20 h-1 accent-red-500"
                />
                <Button
                  variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={handleDeleteBelowScore} disabled={deleting}
                >
                  {deleteScoreThreshold.toFixed(1)}점 미만 삭제
                  <span className="ml-1 text-zinc-500">
                    ({items.filter(i => i.eval_overall > 0 && i.eval_overall < deleteScoreThreshold).length}개)
                  </span>
                </Button>
              </div>

              <div className="ml-auto">
                <Button
                  variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10"
                  onClick={handleDeleteAll} disabled={deleting}
                >
                  전체 삭제
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(item => {
            const isExpanded = expandedId === item.id;
            const hasPipelineData = item.source === 'pipeline' && item.eval_overall > 0;
            const rawData = parseRawData(item.raw_json);
            const hasEventChain = rawData?.event_chain && rawData.event_chain.length > 0;

            return (
              <Card
                key={item.id}
                className={`transition-all cursor-pointer group ${isExpanded ? 'border-emerald-500/50 md:col-span-2 xl:col-span-3' : 'hover:border-emerald-500/30'} ${selectedIds.has(item.id) ? 'ring-1 ring-emerald-500/50' : ''}`}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={e => { e.stopPropagation(); toggleSelect(item.id); }}
                        onClick={e => e.stopPropagation()}
                        className="w-3.5 h-3.5 accent-emerald-500 rounded mt-1 shrink-0"
                      />
                      <div className="min-w-0">
                      <CardTitle className="text-base leading-tight">{item.title}</CardTitle>
                      {rawData?.protagonist && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="text-foreground font-medium">{rawData.protagonist.name}</span>
                          {' — '}{rawData.protagonist.desire}
                        </p>
                      )}
                      {hasPipelineData && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-sm font-bold ${scoreColor(item.eval_overall)}`}>{item.eval_overall.toFixed(1)}</span>
                          <span className="text-[10px] text-muted-foreground">/5</span>
                          {rawData?.formulaPenalty && rawData.formulaPenalty < 0 && (
                            <Badge variant="outline" className="text-[9px] border-red-500/40 text-red-400">공식감점 {rawData.formulaPenalty}</Badge>
                          )}
                        </div>
                      )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 shrink-0 justify-end">
                      <Badge variant="outline" className={`text-[10px] ${item.source === 'pipeline' ? 'border-emerald-500/40 text-emerald-400' : ''}`}>
                        {item.source === 'pipeline' ? 'Drama' : 'Manual'}
                      </Badge>
                      {rawData?.beatTemplate && TEMPLATE_LABELS[rawData.beatTemplate] && (
                        <Badge variant="outline" className={`text-[10px] ${TEMPLATE_COLORS[rawData.beatTemplate] || ''}`}>
                          {TEMPLATE_LABELS[rawData.beatTemplate]}
                        </Badge>
                      )}
                      {rawData?.endingType && ENDING_LABELS[rawData.endingType] && (
                        <Badge variant="outline" className="text-[10px] border-zinc-500/40 text-zinc-400">
                          {ENDING_LABELS[rawData.endingType]}
                        </Badge>
                      )}
                      {item.genre && <Badge variant="secondary" className="text-[10px]">{item.genre}</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!hasEventChain && item.logline && <p className="text-sm text-muted-foreground line-clamp-2">{item.logline}</p>}
                  {item.hook && !isExpanded && <p className="text-xs text-emerald-400 line-clamp-1">{item.hook}</p>}

                  {!isExpanded && hasEventChain && (
                    <div className="space-y-0.5">
                      {rawData!.event_chain!.slice(0, 3).map((e, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[11px]">
                          <span className="shrink-0">{BEAT_EMOJIS[e.beat] || '▸'}</span>
                          <span className="text-muted-foreground line-clamp-1">{e.event}</span>
                        </div>
                      ))}
                      {rawData!.event_chain!.length > 3 && (
                        <p className="text-[10px] text-zinc-500 pl-5">...+{rawData!.event_chain!.length - 3}개 beat</p>
                      )}
                    </div>
                  )}

                  {!isExpanded && !hasEventChain && (
                    <div className="flex flex-wrap gap-1">
                      {item.tone && <Badge variant="outline" className="text-[10px]">{item.tone}</Badge>}
                    </div>
                  )}

                  {isExpanded && (
                    <div className="space-y-4 pt-2">
                      {rawData?.protagonist && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-2.5 rounded bg-blue-500/10 border border-blue-500/20">
                            <span className="text-[10px] font-medium text-blue-400">Desire (원하는 것)</span>
                            <p className="text-xs mt-1">{rawData.protagonist.desire}</p>
                          </div>
                          <div className="p-2.5 rounded bg-orange-500/10 border border-orange-500/20">
                            <span className="text-[10px] font-medium text-orange-400">Flaw (결함)</span>
                            <p className="text-xs mt-1">{rawData.protagonist.flaw}</p>
                          </div>
                        </div>
                      )}

                      {hasEventChain && (
                        <div>
                          <Label className="text-xs text-muted-foreground mb-2 block">사건 체인 ({rawData!.event_chain!.length} beats)</Label>
                          <EventChainDisplay events={rawData!.event_chain!} />
                        </div>
                      )}

                      {!hasEventChain && item.synopsis && (
                        <div>
                          <Label className="text-xs text-muted-foreground">시놉시스</Label>
                          <p className="text-sm mt-1 leading-relaxed">{item.synopsis}</p>
                        </div>
                      )}

                      {rawData?.keyRelationship && (
                        <div className="p-2.5 rounded bg-pink-500/10 border border-pink-500/20">
                          <span className="text-[10px] font-medium text-pink-400">핵심 관계: {rawData.keyRelationship.person} — {rawData.keyRelationship.bond}</span>
                          <p className="text-xs mt-1 text-muted-foreground">{rawData.keyRelationship.tension}</p>
                        </div>
                      )}

                      {rawData?.smallMoment && (
                        <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20">
                          <span className="text-[10px] font-medium text-amber-400">💡 Small Moment</span>
                          <p className="text-xs mt-1">{rawData.smallMoment}</p>
                        </div>
                      )}

                      {rawData?.why_this_premise_matters && (
                        <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                          <span className="text-[10px] font-medium text-emerald-400">이 소재가 필수인 이유</span>
                          <p className="text-xs mt-1">{rawData.why_this_premise_matters}</p>
                        </div>
                      )}

                      {item.hook && (
                        <div className="p-2.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                          <span className="text-[10px] font-medium text-cyan-400">고유 매력</span>
                          <p className="text-xs mt-1">{item.hook}</p>
                        </div>
                      )}

                      {hasPipelineData && (
                        <div className="p-3 rounded bg-zinc-900/50 border border-zinc-700/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">AI 평가</span>
                            <span className={`text-xs font-bold ${scoreColor(item.eval_overall)}`}>종합 {item.eval_overall.toFixed(1)}/5</span>
                          </div>
                          <ScoreBar label="보고 싶은가" value={item.eval_clarity} />
                          <ScoreBar label="캐릭터 호감" value={item.eval_focus} />
                          <ScoreBar label="관계 중심" value={item.eval_narrative_flow} />
                          <ScoreBar label="자연스러움" value={item.eval_conflict || rawData?.naturalness || 0} />
                          <ScoreBar label="소재↔관계" value={item.eval_freshness} />
                          {item.eval_summary && (
                            <p className="text-[10px] text-muted-foreground mt-1 italic">&ldquo;{item.eval_summary}&rdquo;</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rawData?.strengths?.map((s: string, i: number) => (
                              <Badge key={`s-${i}`} variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30">{s}</Badge>
                            ))}
                            {rawData?.weaknesses?.map((w: string, i: number) => (
                              <Badge key={`w-${i}`} variant="outline" className="text-[9px] text-red-400 border-red-500/30">{w}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <SeedBadges seedJson={item.seed_json} />

                      <div className="flex flex-wrap gap-1">
                        {item.genre && <Badge variant="secondary" className="text-[10px]">{item.genre}</Badge>}
                        {item.tone && <Badge variant="outline" className="text-[10px]">{item.tone}</Badge>}
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs" onClick={e => { e.stopPropagation(); handleUseIdea(item); }}>
                          이걸로 시작 →
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={e => { e.stopPropagation(); if (confirm('삭제?')) handleDelete(item.id); }}>
                          삭제
                        </Button>
                      </div>
                    </div>
                  )}

                  {!isExpanded && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString('ko-KR')}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={e => { e.stopPropagation(); handleUseIdea(item); }}>이걸로 시작</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={e => { e.stopPropagation(); if (confirm('삭제?')) handleDelete(item.id); }}>삭제</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && !generating && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎭</div>
            <h2 className="text-xl font-semibold mb-2">살아있는 이야기를 만들어보세요</h2>
            <p className="text-muted-foreground mb-1">Drama Engine이 설정 카드가 아닌 사건 체인을 생성합니다</p>
            <p className="text-xs text-muted-foreground mb-4">주인공의 desire → 사건 체인 → Anti-Cliche 필터 → 평가</p>
            <Button onClick={handleGenerate} disabled={generating} className="bg-emerald-600 hover:bg-emerald-700">
              첫 이야기 생성하기
            </Button>
          </div>
        )}

        {generating && (
          <div className="text-center py-16">
            <div className="animate-spin h-8 w-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1">Drama Pipeline 실행 중...</h2>
            <p className="text-sm text-muted-foreground">{stageLabel || '씨앗 → Drama Engine → Anti-Cliche → 평가'}</p>
            <p className="text-xs text-muted-foreground mt-1">약 30초~1분 소요 (다른 페이지로 이동해도 계속 진행됩니다)</p>
          </div>
        )}
      </main>
    </div>
  );
}
