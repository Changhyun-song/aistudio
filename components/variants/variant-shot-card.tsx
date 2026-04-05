'use client';

import { useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { VariantPrompt, VariantStatus } from '@/types';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<VariantStatus, { bg: string; label: string }> = {
  pending:  { bg: 'bg-zinc-600',   label: 'Pending' },
  sent:     { bg: 'bg-blue-600',   label: 'Sent' },
  uploaded: { bg: 'bg-cyan-600',   label: 'Pasted' },
  keep:     { bg: 'bg-green-600',  label: 'Keep' },
  reject:   { bg: 'bg-red-600',    label: 'Reject' },
  maybe:    { bg: 'bg-yellow-600', label: 'Maybe' },
};

interface VariantShotCardProps {
  variant: VariantPrompt;
  isActive: boolean;
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: VariantStatus) => void;
  onPasteClick: (id: string) => void;
}

export function VariantShotCard({ variant, isActive, onSelect, onStatusChange, onPasteClick }: VariantShotCardProps) {
  const v = variant;
  const hasImage = !!(v.image_url || v.image_path);
  const st = STATUS_CONFIG[v.status];

  const copyPrompt = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(v.prompt);
    toast.success(`[${v.slot}] ${v.label} 프롬프트 복사됨`);
  }, [v.prompt, v.slot, v.label]);

  const handlePasteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onPasteClick(v.id);
  }, [v.id, onPasteClick]);

  const handleStatus = useCallback((e: React.MouseEvent, status: VariantStatus) => {
    e.stopPropagation();
    onStatusChange(v.id, status);
  }, [v.id, onStatusChange]);

  return (
    <div
      onClick={() => onSelect(v.id)}
      className={cn(
        'rounded-lg border overflow-hidden transition-all cursor-pointer select-none',
        'bg-card hover:bg-card/80',
        isActive && 'ring-2 ring-primary border-primary shadow-lg shadow-primary/10',
        !isActive && 'border-border hover:border-primary/30',
        v.status === 'reject' && 'opacity-40',
        v.status === 'keep' && !isActive && 'border-green-500/40',
      )}
    >
      {/* Image Area */}
      <div className="aspect-[2/3] bg-muted relative overflow-hidden">
        {hasImage ? (
          <img
            src={v.image_url || v.image_path}
            alt={v.label}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className={cn(
            'w-full h-full flex flex-col items-center justify-center gap-1.5 transition-colors',
            isActive ? 'bg-primary/5' : 'bg-muted',
          )}>
            <svg className="w-6 h-6 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
            <span className="text-[10px] text-muted-foreground">Paste image</span>
            {isActive && (
              <kbd className="px-1 py-0.5 rounded bg-zinc-700 text-zinc-400 text-[9px] font-mono border border-zinc-600 mt-0.5">Ctrl+V</kbd>
            )}
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-1.5 left-1.5 flex gap-1">
          <Badge variant="secondary" className="text-[10px] h-5 tabular-nums">{v.slot}</Badge>
          <Badge className={cn(st.bg, 'text-white text-[10px] h-5')}>{st.label}</Badge>
        </div>
      </div>

      {/* Info + Actions */}
      <div className="p-2 space-y-1.5">
        <p className="text-[11px] font-medium truncate">{v.label}</p>

        {/* Action Buttons */}
        <div className="flex gap-1">
          <button
            onClick={copyPrompt}
            className="flex-1 h-6 rounded bg-zinc-700 hover:bg-zinc-600 text-[10px] text-zinc-300 transition-colors"
          >
            📋 Copy
          </button>
          <button
            onClick={handlePasteClick}
            className={cn(
              'flex-1 h-6 rounded text-[10px] transition-colors',
              isActive
                ? 'bg-primary/20 text-primary hover:bg-primary/30'
                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300',
            )}
          >
            📌 Paste
          </button>
        </div>

        {/* Keep / Maybe / Reject */}
        {hasImage && (
          <div className="flex gap-1">
            {([
              { s: 'keep' as VariantStatus, icon: '✅', activeBg: 'bg-green-600 text-white', label: 'K' },
              { s: 'maybe' as VariantStatus, icon: '🤔', activeBg: 'bg-yellow-600 text-black', label: 'M' },
              { s: 'reject' as VariantStatus, icon: '❌', activeBg: 'bg-red-600 text-white', label: 'R' },
            ]).map(btn => (
              <button
                key={btn.s}
                onClick={e => handleStatus(e, btn.s)}
                className={cn(
                  'flex-1 h-6 rounded text-[10px] transition-all',
                  v.status === btn.s
                    ? btn.activeBg
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
                )}
              >
                {btn.icon}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
