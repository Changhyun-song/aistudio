'use client';

import { Badge } from '@/components/ui/badge';

interface ClipboardPasteHintProps {
  activeLabel: string | null;
  activeSlot: number | null;
}

export function ClipboardPasteHint({ activeLabel, activeSlot }: ClipboardPasteHintProps) {
  if (!activeLabel) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted/50 border border-border text-sm">
        <span className="text-muted-foreground">카드를 클릭하여 선택한 뒤</span>
        <kbd className="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 text-xs font-mono border border-zinc-600">Ctrl+V</kbd>
        <span className="text-muted-foreground">로 이미지를 붙여넣으세요</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/30 text-sm">
      <Badge variant="secondary" className="bg-primary text-primary-foreground shrink-0">{activeSlot}</Badge>
      <span className="font-medium truncate">{activeLabel}</span>
      <span className="text-muted-foreground shrink-0">선택됨 —</span>
      <kbd className="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 text-xs font-mono border border-zinc-600 shrink-0">Ctrl+V</kbd>
      <span className="text-muted-foreground shrink-0">로 이미지 붙여넣기</span>
    </div>
  );
}
