'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useWarehouseStore } from '@/lib/store/warehouse-store';
import { useStoryStore } from '@/lib/store/story-store';
import type { ProjectMode, PipelineRunSummary } from '@/types';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: '초안', color: 'bg-zinc-600' },
  prompting: { label: '프롬프트', color: 'bg-blue-600' },
  selecting: { label: '선택', color: 'bg-purple-600' },
  expanding: { label: '확장 생성', color: 'bg-orange-600' },
  curating: { label: '큐레이션', color: 'bg-yellow-600' },
  complete: { label: '완료', color: 'bg-green-600' },
};

const MODE_LABELS: Record<ProjectMode, { label: string; badge: string }> = {
  midjourney_manual: { label: 'MJ Manual', badge: 'bg-blue-600' },
  characterizer_40: { label: '40-Shot Auto', badge: 'bg-purple-600' },
  story_studio: { label: 'Story Studio', badge: 'bg-emerald-600' },
};

const PIPELINE_STAGE_LABELS: Record<string, string> = {
  idle: '대기',
  ai1_concept: 'AI 1: 컨셉 생성',
  ai1_eval: 'AI 1: 컨셉 평가',
  ai1_revise: 'AI 1: 컨셉 수정',
  ai2_bible: 'AI 2: Bible 생성',
  ai2_season: 'AI 2: 시즌 플랜',
  ai2_eval: 'AI 2: 시즌 평가',
  ai2_revise: 'AI 2: 시즌 수정',
  ai2_scripts: 'AI 2: 대본 생성',
  ai3_clips: 'AI 3: 클립 생성',
  ai3_eval: 'AI 3: 클립 평가',
  ai3_revise: 'AI 3: 클립 수정',
  season_coherence: '시즌 일관성 평가',
  complete: '완료',
  failed: '실패',
};

function WarehouseButton() {
  const router = useRouter();
  const { generating, stageLabel, stage } = useWarehouseStore();
  return (
    <Button
      variant="outline"
      className={`mr-2 relative ${generating ? 'border-emerald-500/50' : ''}`}
      onClick={() => router.push('/story-warehouse')}
    >
      Story Warehouse
      {generating && (
        <span className="ml-2 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] text-emerald-400 max-w-[120px] truncate">
            {stageLabel || '생성 중'}
          </span>
        </span>
      )}
      {!generating && stage === 'done' && (
        <span className="ml-1.5 text-[10px] text-emerald-400">✓</span>
      )}
    </Button>
  );
}

interface PipelineLogEntry {
  stage: string;
  message: string;
  timestamp: number;
  type: 'info' | 'success' | 'warn' | 'error' | 'score';
}

function formatKoreanDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function PipelineLogModal({ projectId, runId, onClose }: { projectId: string; runId: string; onClose: () => void }) {
  const [logs, setLogs] = useState<PipelineLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/pipeline`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_logs', runId }),
        });
        const data = await res.json();
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      } catch { setLogs([]); }
      setLoading(false);
    })();
  }, [projectId, runId]);

  const typeIcon: Record<string, string> = { success: '\u2713', warn: '\u26a0', error: '\u2717', score: '\u2605', info: '\u2192' };
  const typeColor: Record<string, string> = { success: 'text-emerald-400', warn: 'text-yellow-400', error: 'text-red-400', score: 'text-purple-400', info: 'text-zinc-400' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h3 className="text-sm font-semibold">파이프라인 실행 로그</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-lg">&times;</button>
        </div>
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
          {loading && <p className="text-zinc-500">로딩 중...</p>}
          {!loading && logs.length === 0 && <p className="text-zinc-500">저장된 로그가 없습니다.</p>}
          {logs.map((l, i) => {
            const time = new Date(l.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return (
              <div key={i} className={`${typeColor[l.type] || 'text-zinc-400'} whitespace-pre-wrap mb-0.5`}>
                <span className="text-zinc-600">{time}</span>{' '}
                <span>{typeIcon[l.type] || '\u2192'}</span>{' '}
                <span className="text-zinc-500">[{l.stage}]</span>{' '}
                {l.message}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, fetchProjects, createProject, deleteProject } = useAppStore();
  const resumePipeline = useStoryStore(s => s.resumePipeline);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newMode, setNewMode] = useState<ProjectMode>('story_studio');
  const [open, setOpen] = useState(false);
  const [pipelineMap, setPipelineMap] = useState<Record<string, PipelineRunSummary>>({});
  const [logModal, setLogModal] = useState<{ projectId: string; runId: string } | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await fetch('/api/pipelines/active');
      const data: PipelineRunSummary[] = await res.json();
      const map: Record<string, PipelineRunSummary> = {};
      for (const p of data) map[p.project_id] = p;
      setPipelineMap(map);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchProjects(); fetchPipelines(); }, [fetchProjects, fetchPipelines]);

  useEffect(() => {
    const hasRunning = Object.values(pipelineMap).some(p => p.status === 'running');
    if (!hasRunning) return;
    const interval = setInterval(fetchPipelines, 3000);
    return () => clearInterval(interval);
  }, [pipelineMap, fetchPipelines]);

  const handleResume = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setResumingId(projectId);
    try {
      await resumePipeline(projectId);
      fetchPipelines();
    } finally {
      setResumingId(null);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const p = await createProject(newName, newDesc, newMode);
    setNewName(''); setNewDesc(''); setNewMode('story_studio'); setOpen(false);
    const dest = p.mode === 'midjourney_manual'
      ? `/projects/${p.id}/brief`
      : `/projects/${p.id}/story-studio`;
    router.push(dest);
  };

  const getProjectLink = (p: { id: string; mode?: string }) => {
    if (p.mode === 'midjourney_manual') return `/projects/${p.id}/brief`;
    return `/projects/${p.id}/story-studio`;
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI Studio</h1>
            <p className="text-xs text-muted-foreground">Story + Character Pipeline</p>
          </div>
          <WarehouseButton />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>+ 새 프로젝트</DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>새 프로젝트</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">프로젝트 유형</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setNewMode('story_studio')}
                      className={`rounded-lg border-2 p-4 text-left transition-all ${newMode !== 'midjourney_manual' ? 'border-emerald-500 bg-emerald-500/10' : 'border-border hover:border-border/80'}`}
                    >
                      <div className="text-sm font-semibold mb-1">AI Studio</div>
                      <div className="text-xs text-muted-foreground">스토리 기획 + 캐릭터 시각화 + 영상 프롬프트 통합</div>
                    </button>
                    <button
                      onClick={() => setNewMode('midjourney_manual')}
                      className={`rounded-lg border-2 p-4 text-left transition-all ${newMode === 'midjourney_manual' ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-border/80'}`}
                    >
                      <div className="text-sm font-semibold mb-1">MJ Legacy</div>
                      <div className="text-xs text-muted-foreground">Midjourney 수동 워크플로우 (레거시)</div>
                    </button>
                  </div>
                </div>
                <div>
                  <Label>프로젝트 이름</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="예: 수면안대 소녀 하은" className="mt-1" onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                </div>
                <div>
                  <Label>설명 (선택)</Label>
                  <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="간단한 캐릭터 컨셉..." className="mt-1" rows={2} />
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={!newName.trim()}>생성</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {projects.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">🎭</div>
            <h2 className="text-2xl font-semibold mb-2">프로젝트가 없습니다</h2>
            <p className="text-muted-foreground mb-6">새 캐릭터 프로젝트를 만들어 시작하세요</p>
            <Button onClick={() => setOpen(true)}>+ 새 프로젝트</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => {
              const st = STATUS_LABELS[p.status] || STATUS_LABELS.draft;
              const mode = MODE_LABELS[(p.mode || 'midjourney_manual') as ProjectMode] || MODE_LABELS.midjourney_manual;
              const pipeline = pipelineMap[p.id];
              const isRunning = pipeline?.status === 'running';
              const pct = pipeline?.progress_pct ?? 0;
              return (
                <Card key={p.id} className={`hover:border-primary/50 transition-colors cursor-pointer group ${isRunning ? 'border-emerald-500/40' : ''}`} onClick={() => router.push(getProjectLink(p))}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">{p.name}</CardTitle>
                      <div className="flex gap-1.5">
                        <Badge variant="secondary" className={`${mode.badge} text-white text-[10px]`}>{mode.label}</Badge>
                        <Badge variant="secondary" className={`${st.color} text-white text-[10px]`}>{st.label}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {p.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{p.description}</p>}

                    {pipeline && (
                      <div className="mb-3 space-y-2">
                        <div className="flex items-center gap-2">
                          {isRunning && <span className="relative flex h-2 w-2 shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>}
                          {pipeline.status === 'failed' && <span className="relative flex h-2 w-2 shrink-0"><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>}
                          <span className={`text-xs font-medium ${pipeline.status === 'failed' ? 'text-red-400' : pipeline.status === 'aborted' ? 'text-yellow-400' : 'text-emerald-400'}`}>
                            {pipeline.current_stage_label || PIPELINE_STAGE_LABELS[pipeline.current_stage] || pipeline.current_stage}
                          </span>
                          {pipeline.status === 'completed' && <Badge className="bg-emerald-600 text-white text-[10px] h-4">완료</Badge>}
                          {pipeline.status === 'failed' && <Badge className="bg-red-600 text-white text-[10px] h-4">실패</Badge>}
                          {pipeline.status === 'aborted' && <Badge className="bg-yellow-600 text-white text-[10px] h-4">중단</Badge>}
                        </div>

                        {pipeline.status === 'failed' && pipeline.error_message && (
                          <p className="text-[11px] text-red-400/80 line-clamp-2 pl-4">{pipeline.error_message}</p>
                        )}

                        {(pipeline.completed_at || pipeline.updated_at) && !isRunning && (
                          <p className="text-[10px] text-muted-foreground pl-4">
                            {formatKoreanDate(pipeline.completed_at || pipeline.updated_at)}
                          </p>
                        )}

                        {(isRunning || pipeline.status === 'completed') && (
                          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isRunning ? 'bg-emerald-500' : 'bg-emerald-600'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        )}
                        {isRunning && <span className="text-[10px] text-muted-foreground">{pct}%</span>}

                        {!isRunning && (
                          <div className="flex items-center gap-2 pl-4">
                            <button
                              className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2"
                              onClick={e => { e.stopPropagation(); setLogModal({ projectId: p.id, runId: pipeline.id }); }}
                            >
                              로그 보기
                            </button>
                            {(pipeline.status === 'failed' || pipeline.status === 'aborted') && (
                              <button
                                className="text-[10px] text-emerald-400 hover:text-emerald-300 underline underline-offset-2 disabled:opacity-50"
                                disabled={resumingId === p.id}
                                onClick={e => handleResume(e, p.id)}
                              >
                                {resumingId === p.id ? '재시작 중...' : '이어서 실행'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(p.created_at).toLocaleDateString('ko-KR')}</span>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); if (confirm('삭제하시겠습니까?')) deleteProject(p.id); }}>삭제</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      {logModal && (
        <PipelineLogModal
          projectId={logModal.projectId}
          runId={logModal.runId}
          onClose={() => setLogModal(null)}
        />
      )}
    </div>
  );
}
