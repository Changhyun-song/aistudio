import { create } from 'zustand';

export interface WarehouseGenerationStats {
  totalSeeds: number;
  totalDramas: number;
  totalEvaluated: number;
  passedCount: number;
  failedCount: number;
  clicheFiltered: number;
  failedPreviews: { title: string; score: number; reason: string }[];
  errors?: string[];
}

type WarehouseStage = 'idle' | 'seeds' | 'drama' | 'filter' | 'evaluating' | 'saving' | 'done' | 'error';

interface WarehouseState {
  generating: boolean;
  stage: WarehouseStage;
  stageLabel: string;
  progressPct: number;
  stats: WarehouseGenerationStats | null;
  error: string | null;
  lastGeneratedAt: number | null;

  runGeneration: (seedCount?: number, passThreshold?: number) => void;
  checkStatus: () => Promise<void>;
  reset: () => void;
}

let _pollTimer: ReturnType<typeof setInterval> | null = null;

function stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

function startPolling() {
  stopPolling();
  _pollTimer = setInterval(() => {
    useWarehouseStore.getState().checkStatus();
  }, 4000);
}

const STAGE_LABELS: Record<string, { label: string; pct: number }> = {
  seeds: { label: '씨앗 생성 중...', pct: 10 },
  drama: { label: 'Drama Engine 실행 중...', pct: 30 },
  filter: { label: 'Anti-Cliche 필터 적용 중...', pct: 60 },
  evaluating: { label: '평가 중...', pct: 75 },
  saving: { label: '저장 중...', pct: 90 },
};

export const useWarehouseStore = create<WarehouseState>((set, get) => ({
  generating: false,
  stage: 'idle',
  stageLabel: '',
  progressPct: 0,
  stats: null,
  error: null,
  lastGeneratedAt: null,

  reset: () => { stopPolling(); set({ generating: false, stage: 'idle', stageLabel: '', progressPct: 0, stats: null, error: null }); },

  checkStatus: async () => {
    try {
      const res = await fetch('/api/story-warehouse/generate');
      if (!res.ok) return;
      const job = await res.json();

      if (job.running) {
        const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
        const stageInfo = STAGE_LABELS[job.stage] || { label: '생성 중...', pct: 50 };
        if (!get().generating) {
          startPolling();
        }
        set({
          generating: true,
          stage: (job.stage || 'seeds') as WarehouseStage,
          stageLabel: `${stageInfo.label} (${elapsed}초 경과)`,
          progressPct: stageInfo.pct,
          error: null,
        });
      } else if (!job.running && get().generating) {
        stopPolling();
        if (job.stage === 'done' && job.stats) {
          const stats = job.stats as WarehouseGenerationStats;
          let errorMsg: string | null = null;
          if (stats.errors && stats.errors.length > 0) {
            errorMsg = `일부 단계에서 문제 발생:\n${stats.errors.join('\n')}`;
          }
          set({
            generating: false,
            stage: 'done',
            stageLabel: `완료! ${stats.totalDramas || 0}개 Drama → ${stats.clicheFiltered || 0}개 공식 필터 → ${stats.passedCount || 0}개 통과`,
            progressPct: 100,
            stats,
            error: errorMsg,
            lastGeneratedAt: Date.now(),
          });
        } else if (job.stage === 'error') {
          set({
            generating: false,
            stage: 'error',
            stageLabel: '',
            progressPct: 0,
            error: job.error || '생성 중 오류 발생',
          });
        } else {
          set({ generating: false, stage: 'idle', stageLabel: '', progressPct: 0 });
        }
      }
    } catch { /* polling failure is non-critical */ }
  },

  runGeneration: (seedCount = 5, passThreshold = 4.0) => {
    if (get().generating) return;

    set({
      generating: true,
      stage: 'seeds',
      stageLabel: '파이프라인 시작 요청 중...',
      progressPct: 5,
      stats: null,
      error: null,
    });

    // Fire-and-forget: send POST, don't await response
    fetch('/api/story-warehouse/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seedCount, passThreshold }),
    }).then(res => {
      if (!res.ok && res.status !== 409) {
        return res.json().then(data => {
          set({
            generating: false,
            stage: 'error',
            stageLabel: '',
            progressPct: 0,
            error: data.error || `서버 오류 (${res.status})`,
          });
          stopPolling();
        });
      }
    }).catch(() => {
      // POST failed but server might still have received it — polling will catch up
    });

    // Start polling immediately — don't wait for POST response
    startPolling();
  },
}));
