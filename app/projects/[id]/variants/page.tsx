'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { useClipboardImagePaste } from '@/hooks/use-clipboard-image-paste';
import { VariantShotCard } from '@/components/variants/variant-shot-card';
import { ClipboardPasteHint } from '@/components/variants/clipboard-paste-hint';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { VariantPrompt, VariantStatus } from '@/types';
import { toast } from 'sonner';

export default function VariantsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const { variants, fetchVariants, updateVariant, aiTwenty, baseCharacter, fetchBase, loading, error, clearError } = useAppStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<VariantPrompt | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchVariants(projectId);
    fetchBase(projectId);
  }, [projectId, fetchVariants, fetchBase]);

  // Auto-select first card with no image
  useEffect(() => {
    if (variants.length > 0 && !activeId) {
      const first = variants.find(v => !v.image_url && !v.image_path);
      if (first) setActiveId(first.id);
      else setActiveId(variants[0].id);
    }
  }, [variants, activeId]);

  const activeVariant = variants.find(v => v.id === activeId);

  // ── Upload logic (hidden behind paste adapter) ─────
  const uploadFile = useCallback(async (variantId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('projectId', projectId);
    form.append('category', 'variants');
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    await updateVariant(projectId, variantId, { image_path: data.path, status: 'uploaded' });
  }, [projectId, updateVariant]);

  // ── Clipboard paste handler ────────────────────────
  const handlePasteImage = useCallback(async (targetId: string, file: File) => {
    await uploadFile(targetId, file);
    const v = variants.find(x => x.id === targetId);
    toast.success(`[${v?.slot}] ${v?.label} — 이미지 붙여넣기 완료`);

    // Auto-advance to next card without image
    const currentIdx = variants.findIndex(x => x.id === targetId);
    const next = variants.slice(currentIdx + 1).find(x => !x.image_url && !x.image_path);
    if (next) setActiveId(next.id);
  }, [uploadFile, variants]);

  useClipboardImagePaste({
    activeId,
    onPaste: handlePasteImage,
    enabled: variants.length > 0,
  });

  // ── Manual paste button (reads clipboard API) ──────
  const handleManualPaste = useCallback(async (variantId: string) => {
    setActiveId(variantId);
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], `paste_${Date.now()}.png`, { type: imageType });
          await handlePasteImage(variantId, file);
          return;
        }
      }
      toast.info('클립보드에 이미지가 없습니다. 이미지를 복사한 뒤 다시 시도하세요.');
    } catch {
      toast.info('Ctrl+V로 붙여넣어 주세요 (브라우저 권한 필요)');
    }
  }, [handlePasteImage]);

  // ── Status change ──────────────────────────────────
  const handleStatusChange = useCallback(async (variantId: string, status: VariantStatus) => {
    await updateVariant(projectId, variantId, { status });
  }, [projectId, updateVariant]);

  // ── Generate ───────────────────────────────────────
  const handleGenerate = async () => {
    try {
      await aiTwenty(projectId);
      toast.success('20개 확장 프롬프트가 생성되었습니다');
    } catch {
      toast.error(error || '생성 실패');
      clearError();
    }
  };

  const copyAll = async () => {
    const text = variants.map(v => `[${v.slot}] ${v.label}\n${v.prompt}`).join('\n\n---\n\n');
    await navigator.clipboard.writeText(text);
    toast.success('전체 프롬프트 복사됨');
  };

  // ── Keyboard navigation ────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!variants.length || editModal) return;
      const idx = variants.findIndex(v => v.id === activeId);
      if (idx === -1) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = variants[Math.min(idx + 1, variants.length - 1)];
        setActiveId(next.id);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = variants[Math.max(idx - 1, 0)];
        setActiveId(prev.id);
      } else if (e.key === '1') {
        handleStatusChange(variants[idx].id, 'keep');
      } else if (e.key === '2') {
        handleStatusChange(variants[idx].id, 'maybe');
      } else if (e.key === '3') {
        handleStatusChange(variants[idx].id, 'reject');
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [variants, activeId, editModal, handleStatusChange]);

  // ── Filter ─────────────────────────────────────────
  const filtered = variants.filter(v => {
    if (filter === 'all') return true;
    if (filter === 'no_image') return !v.image_url && !v.image_path;
    return v.status === filter;
  });

  const stats = {
    total: variants.length,
    pasted: variants.filter(v => v.image_url || v.image_path).length,
    keep: variants.filter(v => v.status === 'keep').length,
    reject: variants.filter(v => v.status === 'reject').length,
    maybe: variants.filter(v => v.status === 'maybe').length,
  };

  // ── Empty state ────────────────────────────────────
  if (variants.length === 0) {
    return (
      <div className="text-center py-24">
        <div className="text-6xl mb-4">🔄</div>
        <h2 className="text-2xl font-semibold mb-2">확장 프롬프트가 없습니다</h2>
        <p className="text-muted-foreground mb-6">
          {baseCharacter ? 'AI가 20장 확장 프롬프트를 생성합니다' : '먼저 Select 탭에서 기준 캐릭터를 선택하세요'}
        </p>
        {baseCharacter ? (
          <Button onClick={handleGenerate} disabled={loading}>{loading ? '생성 중...' : 'AI 20장 프롬프트 생성'}</Button>
        ) : (
          <Button onClick={() => router.push(`/projects/${projectId}/select`)}>Select로 이동 →</Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">20-Shot Variants</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Copy Prompt → Midjourney 실행 → 이미지 복사 → 카드 선택 후 Ctrl+V
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyAll}>📋 전체 복사</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('https://www.midjourney.com/imagine', '_blank')}>MJ ↗</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('https://discord.gg/F5xayuq2', '_blank')}>Discord ↗</Button>
          <Button size="sm" onClick={() => router.push(`/projects/${projectId}/dataset`)} disabled={stats.keep < 1}>
            Dataset →
          </Button>
        </div>
      </div>

      {/* Paste Hint */}
      <ClipboardPasteHint
        activeLabel={activeVariant?.label || null}
        activeSlot={activeVariant?.slot || null}
      />

      {/* Stats + Filters */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <span>이미지: <strong>{stats.pasted}</strong>/20</span>
        <span className="text-green-400">Keep: {stats.keep}</span>
        <span className="text-red-400">Reject: {stats.reject}</span>
        <span className="text-yellow-400">Maybe: {stats.maybe}</span>
        <span className="text-muted-foreground text-xs ml-2">키보드: ← → 이동 · 1 Keep · 2 Maybe · 3 Reject</span>
        <div className="flex gap-1 ml-auto">
          {[
            { k: 'all', l: '전체' },
            { k: 'no_image', l: '이미지 필요' },
            { k: 'keep', l: '✅ Keep' },
            { k: 'maybe', l: '🤔 Maybe' },
          ].map(f => (
            <Button key={f.k} variant={filter === f.k ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f.k)} className="text-xs h-7">
              {f.l}
            </Button>
          ))}
        </div>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filtered.map(v => (
          <VariantShotCard
            key={v.id}
            variant={v}
            isActive={activeId === v.id}
            onSelect={setActiveId}
            onStatusChange={handleStatusChange}
            onPasteClick={handleManualPaste}
          />
        ))}
      </div>

      {/* Prompt Edit Modal — double-click a card's prompt area to open */}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editModal?.label} — Prompt</DialogTitle></DialogHeader>
          {editModal && (
            <div className="space-y-3">
              <Textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} className="min-h-[180px] font-mono text-sm" />
              <div className="flex gap-2 flex-wrap">
                <Button onClick={async () => { await navigator.clipboard.writeText(editPrompt); toast.success('복사됨'); }}>📋 복사</Button>
                <Button variant="outline" onClick={async () => { await updateVariant(projectId, editModal.id, { prompt: editPrompt }); setEditModal(null); toast.success('저장됨'); }}>저장</Button>
                <Button variant="outline" onClick={() => window.open('https://www.midjourney.com/imagine', '_blank')}>MJ Create ↗</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
