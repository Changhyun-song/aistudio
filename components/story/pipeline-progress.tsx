'use client';

import { useStoryStore } from '@/lib/store/story-store';
import type { PipelineLog, PipelineStage } from '@/lib/store/story-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEffect, useRef, useState } from 'react';

const STAGE_LABELS: Record<PipelineStage, string> = {
  idle: '대기',
  ai1_concept: 'AI 1: 컨셉 생성',
  ai1_eval: 'AI 1: 평가',
  ai1_revise: 'AI 1: 수정',
  ai2_bible: 'AI 2: Bible 생성',
  ai2_season: 'AI 2: 시즌 플랜',
  ai2_eval: 'AI 2: 평가',
  ai2_revise: 'AI 2: 수정',
  ai2_scripts: 'AI 2: 에피소드 대본',
  ai3_clips: 'AI 3: 클립 생성',
  ai3_eval: 'AI 3: 평가',
  ai3_revise: 'AI 3: 수정',
  season_coherence: '시즌 일관성 평가',
  complete: '완료',
  failed: '오류',
};

const STAGE_ORDER: PipelineStage[] = [
  'ai1_concept', 'ai1_eval', 'ai1_revise',
  'ai2_bible', 'ai2_season', 'ai2_eval', 'ai2_revise', 'ai2_scripts',
  'ai3_clips', 'ai3_eval', 'ai3_revise',
  'season_coherence',
  'complete',
];

function stageProgress(current: PipelineStage): number {
  const idx = STAGE_ORDER.indexOf(current);
  if (current === 'complete') return 100;
  if (current === 'failed' || current === 'idle') return 0;
  return Math.max(0, Math.round(((idx + 1) / STAGE_ORDER.length) * 100));
}

function logTypeStyle(t: PipelineLog['type']): string {
  switch (t) {
    case 'success': return 'text-emerald-400';
    case 'warn': return 'text-yellow-400';
    case 'error': return 'text-red-400';
    case 'score': return 'text-blue-400';
    default: return 'text-zinc-400';
  }
}

function logIcon(t: PipelineLog['type']): string {
  switch (t) {
    case 'success': return '✓';
    case 'warn': return '⚠';
    case 'error': return '✗';
    case 'score': return '★';
    default: return '→';
  }
}

function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}시간 ${m}분 ${s}초`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

function getScoreLogs(logs: PipelineLog[]): PipelineLog[] {
  return logs.filter(l => l.type === 'score');
}

export function PipelineProgress({ projectId }: { projectId?: string }) {
  const { pipelineRunning, pipelineStage, pipelineLogs, pipelineTargetScore, pipelineMaxRetries, stopPipeline } = useStoryStore();
  const logEndRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [usageInfo, setUsageInfo] = useState<{ totalTokens: number; totalCostUsd: number; callCount: number } | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pipelineLogs.length]);

  useEffect(() => {
    if (!pipelineRunning || pipelineLogs.length === 0) return;
    const startTs = pipelineLogs[0].timestamp;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTs);
    }, 1000);
    return () => clearInterval(interval);
  }, [pipelineRunning, pipelineLogs]);

  useEffect(() => {
    if (!projectId) return;
    const fetchUsage = () => {
      fetch(`/api/projects/${projectId}/usage`)
        .then(r => r.json())
        .then(data => setUsageInfo(data))
        .catch(() => {});
    };
    fetchUsage();
    if (pipelineRunning) {
      const interval = setInterval(fetchUsage, 10000);
      return () => clearInterval(interval);
    }
  }, [projectId, pipelineRunning, pipelineLogs.length]);

  if (pipelineStage === 'idle' && pipelineLogs.length === 0) return null;

  const progress = stageProgress(pipelineStage);
  const isComplete = pipelineStage === 'complete';
  const isFailed = pipelineStage === 'failed';
  const scoreLogs = getScoreLogs(pipelineLogs);
  const lastScore = scoreLogs.length > 0 ? scoreLogs[scoreLogs.length - 1] : null;

  return (
    <div className="border border-purple-500/30 rounded-lg overflow-hidden bg-card/80">
      {/* Header */}
      <div className="p-3 flex items-center justify-between bg-purple-500/5 border-b border-purple-500/20">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${pipelineRunning ? 'bg-purple-500 animate-pulse' : isComplete ? 'bg-emerald-500' : isFailed ? 'bg-red-500' : 'bg-zinc-500'}`} />
          <span className="font-medium text-sm">
            {isComplete ? '파이프라인 완료' : isFailed ? '파이프라인 오류' : pipelineRunning ? '자동 파이프라인 실행 중' : '파이프라인'}
          </span>
          <Badge variant="outline" className="text-[10px]">
            목표: {pipelineTargetScore}/5
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            최대: {pipelineMaxRetries}회
          </Badge>
          {pipelineRunning && elapsed > 0 && (
            <Badge variant="outline" className="text-[10px] bg-zinc-800">
              경과: {formatElapsed(elapsed)}
            </Badge>
          )}
          {lastScore && (
            <Badge variant="outline" className="text-[10px] bg-blue-500/20 text-blue-400">
              최근: {lastScore.message}
            </Badge>
          )}
          {usageInfo && usageInfo.callCount > 0 && (
            <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-400">
              ${usageInfo.totalCostUsd.toFixed(4)} | {(usageInfo.totalTokens / 1000).toFixed(1)}k tok | {usageInfo.callCount}calls
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] ${isComplete ? 'bg-emerald-500/20 text-emerald-400' : isFailed ? 'bg-red-500/20 text-red-400' : 'bg-purple-500/20 text-purple-400'}`}>
            {STAGE_LABELS[pipelineStage]}
          </Badge>
          {pipelineLogs.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px]"
              onClick={() => {
                const text = pipelineLogs.map(l => {
                  const time = new Date(l.timestamp).toLocaleTimeString('ko-KR', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                  });
                  const icons: Record<string, string> = { success: '✓', warn: '⚠', error: '✗', score: '★', info: '→' };
                  return `${time} ${icons[l.type] || '→'} [${l.stage}] ${l.message}`;
                }).join('\n');
                navigator.clipboard.writeText(text).then(() => {
                  const btn = document.activeElement as HTMLButtonElement;
                  if (btn) {
                    const orig = btn.textContent;
                    btn.textContent = '복사됨!';
                    setTimeout(() => { btn.textContent = orig; }, 1500);
                  }
                });
              }}
            >
              로그 복사
            </Button>
          )}
          {pipelineRunning && (
            <Button size="sm" variant="destructive" className="h-6 text-[10px]" onClick={stopPipeline}>
              중지
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 bg-zinc-800">
        <div
          className={`h-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : isFailed ? 'bg-red-500' : 'bg-purple-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stage Pills */}
      <div className="px-3 py-2 flex items-center gap-1 overflow-x-auto border-b border-border">
        {(['AI 1', 'AI 2', 'AI 3'] as const).map((ai) => {
          const isActive =
            (ai === 'AI 1' && pipelineStage.startsWith('ai1')) ||
            (ai === 'AI 2' && pipelineStage.startsWith('ai2')) ||
            (ai === 'AI 3' && pipelineStage.startsWith('ai3'));
          const isDone =
            (ai === 'AI 1' && !pipelineStage.startsWith('ai1') && pipelineStage !== 'idle') ||
            (ai === 'AI 2' && (pipelineStage.startsWith('ai3') || isComplete)) ||
            (ai === 'AI 3' && isComplete);
          return (
            <Badge
              key={ai}
              className={`text-[10px] ${isDone ? 'bg-emerald-600 text-white' : isActive ? 'bg-purple-600 text-white animate-pulse' : 'bg-zinc-700 text-zinc-400'}`}
            >
              {isDone ? `${ai} ✓` : ai}
            </Badge>
          );
        })}
        <span className="text-[10px] text-zinc-500 ml-auto">
          로그: {pipelineLogs.length}건 | 평가: {scoreLogs.length}회
        </span>
      </div>

      {/* Log Output */}
      <div className="max-h-96 overflow-y-auto p-2 font-mono text-[11px] space-y-0.5 bg-zinc-950/50">
        {pipelineLogs.map((l, i) => (
          <div key={i} className={`flex gap-2 ${logTypeStyle(l.type)}`}>
            <span className="text-zinc-600 shrink-0">
              {new Date(l.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="shrink-0 w-4 text-center">{logIcon(l.type)}</span>
            <span className="text-zinc-500 shrink-0">[{l.stage}]</span>
            <span>{l.message}</span>
          </div>
        ))}
        {pipelineRunning && (
          <div className="text-purple-400 animate-pulse flex gap-2">
            <span className="text-zinc-600 shrink-0">...</span>
            <span>처리 중...</span>
          </div>
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
