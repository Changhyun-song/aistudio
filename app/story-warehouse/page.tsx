'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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

interface GenerationStats {
  totalSeeds: number;
  totalPremises: number;
  totalEvaluated: number;
  passedCount: number;
  failedCount: number;
  failedPreviews: { title: string; score: number; reason: string }[];
}

const SCORE_COLORS: Record<string, string> = {
  high: 'text-emerald-400',
  mid: 'text-yellow-400',
  low: 'text-red-400',
};

function scoreColor(v: number) {
  if (v >= 4) return SCORE_COLORS.high;
  if (v >= 3) return SCORE_COLORS.mid;
  return SCORE_COLORS.low;
}

function ScoreBar({ label, value, max = 5 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-muted-foreground shrink-0">{label}</span>
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
      character_irony: '캐릭터', relationship_structure: '관계', social_theme: '사회',
    };
    const catColors: Record<string, string> = {
      genre_combo: 'border-purple-500/40 text-purple-400',
      era_setting: 'border-blue-500/40 text-blue-400',
      what_if: 'border-emerald-500/40 text-emerald-400',
      character_irony: 'border-orange-500/40 text-orange-400',
      relationship_structure: 'border-pink-500/40 text-pink-400',
      social_theme: 'border-cyan-500/40 text-cyan-400',
    };
    return (
      <div className="flex flex-wrap gap-1">
        {seed.elements.map((e: { category: string; item: { value: string } }, i: number) => (
          <Badge key={i} variant="outline" className={`text-[9px] ${catColors[e.category] || ''}`}>
            {catLabels[e.category] || e.category}: {e.item.value.length > 25 ? e.item.value.slice(0, 25) + '…' : e.item.value}
          </Badge>
        ))}
      </div>
    );
  } catch { return null; }
}

export default function StoryWarehousePage() {
  const router = useRouter();
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualLogline, setManualLogline] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [filterSource, setFilterSource] = useState<'all' | 'pipeline' | 'manual'>('all');

  const fetchItems = useCallback(async () => {
    const url = search ? `/api/story-warehouse?q=${encodeURIComponent(search)}` : '/api/story-warehouse';
    const res = await fetch(url);
    if (res.ok) setItems(await res.json());
  }, [search]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleGenerate = async () => {
    setGenerating(true);
    setStats(null);
    try {
      const res = await fetch('/api/story-warehouse/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedCount: 5 }),
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || null);
        await fetchItems();
      }
    } finally {
      setGenerating(false);
    }
  };

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

  const handleDelete = async (id: string) => {
    await fetch(`/api/story-warehouse/${id}`, { method: 'DELETE' });
    fetchItems();
  };

  const handleUseIdea = async (item: WarehouseItem) => {
    // Record pick for self-improvement
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

  const parseTags = (tagsStr: string): string[] => {
    try { return JSON.parse(tagsStr); } catch { return []; }
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
            <Link href="/projects" className="text-muted-foreground hover:text-foreground text-sm">
              ← Projects
            </Link>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Story Warehouse</h1>
              <p className="text-xs text-muted-foreground">4단계 파이프라인: 씨앗 → 스토리화 → 평가 → 큐레이션</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>+ 수동 추가</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Pipeline Trigger */}
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <h2 className="text-sm font-semibold text-emerald-400">AI 스토리 아이디어 파이프라인</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  1. 6개 소재 풀에서 랜덤 씨앗 5세트 조합 →
                  2. AI가 각 씨앗으로 2개 스토리 전제 생성 (10개) →
                  3. AI가 5개 기준으로 평가 →
                  4. 3.5점 이상만 표시
                </p>
                {stats && (
                  <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground mt-2 p-2 rounded bg-zinc-900/50">
                    <span>씨앗: {stats.totalSeeds}세트</span>
                    <span>전제: {stats.totalPremises}개</span>
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

        {/* Manual Add */}
        {showAdd && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <Input value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="아이디어 제목" />
              <Textarea value={manualLogline} onChange={e => setManualLogline(e.target.value)} placeholder="로그라인 / 아이디어 설명" rows={2} />
              <Button onClick={handleManualAdd} disabled={!manualTitle.trim()} size="sm">추가</Button>
            </CardContent>
          </Card>
        )}

        {/* Filters & Sort */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="검색..."
              className="w-60 h-8 text-sm"
            />
            <div className="flex gap-1">
              {(['all', 'pipeline', 'manual'] as const).map(f => (
                <Button
                  key={f}
                  variant={filterSource === f ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFilterSource(f)}
                >
                  {f === 'all' ? '전체' : f === 'pipeline' ? 'AI 파이프라인' : '수동'}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {pipelineItems.length > 0 && <span>평균 점수: <span className={scoreColor(avgScore)}>{avgScore.toFixed(1)}/5</span></span>}
            <span>{filtered.length}개</span>
            <div className="flex gap-1">
              <Button variant={sortBy === 'date' ? 'default' : 'outline'} size="sm" className="h-6 text-[10px]" onClick={() => setSortBy('date')}>최신순</Button>
              <Button variant={sortBy === 'score' ? 'default' : 'outline'} size="sm" className="h-6 text-[10px]" onClick={() => setSortBy('score')}>점수순</Button>
            </div>
          </div>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(item => {
            const isExpanded = expandedId === item.id;
            const hasPipelineData = item.source === 'pipeline' && item.eval_overall > 0;
            return (
              <Card
                key={item.id}
                className={`transition-all cursor-pointer group ${isExpanded ? 'border-emerald-500/50 md:col-span-2 xl:col-span-2' : 'hover:border-emerald-500/30'}`}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-tight">{item.title}</CardTitle>
                      {hasPipelineData && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-sm font-bold ${scoreColor(item.eval_overall)}`}>
                            {item.eval_overall.toFixed(1)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">/5</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Badge variant="outline" className={`text-[10px] ${item.source === 'pipeline' ? 'border-emerald-500/40 text-emerald-400' : ''}`}>
                        {item.source === 'pipeline' ? 'Pipeline' : item.source === 'ai_generated' ? 'AI' : 'Manual'}
                      </Badge>
                      {item.expected_episodes && (
                        <Badge variant="secondary" className="text-[10px]">{item.expected_episodes}</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {item.logline && <p className="text-sm text-muted-foreground line-clamp-2">{item.logline}</p>}
                  {item.hook && !isExpanded && <p className="text-xs text-emerald-400 line-clamp-1">{item.hook}</p>}

                  {!isExpanded && (
                    <div className="flex flex-wrap gap-1">
                      {item.genre && <Badge variant="secondary" className="text-[10px]">{item.genre}</Badge>}
                      {item.tone && <Badge variant="outline" className="text-[10px]">{item.tone}</Badge>}
                      {parseTags(item.tags).slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-[10px] text-zinc-400">{tag}</Badge>
                      ))}
                    </div>
                  )}

                  {/* Expanded View */}
                  {isExpanded && (
                    <div className="space-y-4 pt-2">
                      {item.hook && (
                        <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                          <span className="text-[10px] font-medium text-emerald-400 block mb-0.5">고유 매력</span>
                          <p className="text-sm">{item.hook}</p>
                        </div>
                      )}

                      {item.synopsis && (
                        <div>
                          <Label className="text-xs text-muted-foreground">시놉시스</Label>
                          <p className="text-sm mt-1 leading-relaxed">{item.synopsis}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        {item.inner_conflict && (
                          <div className="p-2.5 rounded bg-orange-500/10 border border-orange-500/20">
                            <span className="text-[10px] font-medium text-orange-400">내적 갈등</span>
                            <p className="text-xs mt-1">{item.inner_conflict}</p>
                          </div>
                        )}
                        {item.outer_obstacle && (
                          <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20">
                            <span className="text-[10px] font-medium text-red-400">외적 장애물</span>
                            <p className="text-xs mt-1">{item.outer_obstacle}</p>
                          </div>
                        )}
                      </div>

                      {hasPipelineData && (
                        <div className="p-3 rounded bg-zinc-900/50 border border-zinc-700/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">AI 평가</span>
                            <span className={`text-xs font-bold ${scoreColor(item.eval_overall)}`}>
                              종합 {item.eval_overall.toFixed(1)}/5
                            </span>
                          </div>
                          <ScoreBar label="참신함" value={item.eval_freshness} />
                          <ScoreBar label="갈등력" value={item.eval_conflict} />
                          <ScoreBar label="공감" value={item.eval_empathy} />
                          <ScoreBar label="비주얼" value={item.eval_visual} />
                          <ScoreBar label="확장성" value={item.eval_expandability} />
                          {item.eval_summary && (
                            <p className="text-[10px] text-muted-foreground mt-1 italic">"{item.eval_summary}"</p>
                          )}
                          {(() => {
                            try {
                              const raw = JSON.parse(item.raw_json || '{}');
                              return (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {raw.strengths?.map((s: string, i: number) => (
                                    <Badge key={`s-${i}`} variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30">{s}</Badge>
                                  ))}
                                  {raw.weaknesses?.map((w: string, i: number) => (
                                    <Badge key={`w-${i}`} variant="outline" className="text-[9px] text-red-400 border-red-500/30">{w}</Badge>
                                  ))}
                                </div>
                              );
                            } catch { return null; }
                          })()}
                        </div>
                      )}

                      <SeedBadges seedJson={item.seed_json} />

                      <div className="flex flex-wrap gap-1">
                        {item.genre && <Badge variant="secondary" className="text-[10px]">{item.genre}</Badge>}
                        {item.tone && <Badge variant="outline" className="text-[10px]">{item.tone}</Badge>}
                        {item.target_audience && <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-500/30">{item.target_audience}</Badge>}
                        {parseTags(item.tags).map(tag => (
                          <Badge key={tag} variant="outline" className="text-[10px] text-zinc-400">{tag}</Badge>
                        ))}
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
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString('ko-KR')}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={e => { e.stopPropagation(); handleUseIdea(item); }}>
                          이걸로 시작
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={e => { e.stopPropagation(); if (confirm('삭제?')) handleDelete(item.id); }}>
                          삭제
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {items.length === 0 && !generating && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">💡</div>
            <h2 className="text-xl font-semibold mb-2">아이디어가 없습니다</h2>
            <p className="text-muted-foreground mb-1">AI가 4단계 파이프라인으로 창의적인 스토리 아이디어를 생성합니다</p>
            <p className="text-xs text-muted-foreground mb-4">씨앗 조합 → 스토리화 → 평가 → 큐레이션</p>
            <Button onClick={handleGenerate} className="bg-emerald-600 hover:bg-emerald-700">
              첫 아이디어 생성하기
            </Button>
          </div>
        )}

        {generating && items.length === 0 && (
          <div className="text-center py-16">
            <div className="animate-spin h-8 w-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1">파이프라인 실행 중...</h2>
            <p className="text-sm text-muted-foreground">씨앗 5세트 → 전제 10개 → 평가 → 필터링</p>
            <p className="text-xs text-muted-foreground mt-1">약 30초~1분 소요</p>
          </div>
        )}
      </main>
    </div>
  );
}
