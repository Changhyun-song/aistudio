'use client';

import { useEffect, useCallback } from 'react';

interface UseClipboardImagePasteOptions {
  activeId: string | null;
  onPaste: (activeId: string, file: File) => void;
  enabled?: boolean;
}

/**
 * Global paste event listener that captures clipboard images
 * and routes them to the currently active shot card.
 *
 * Supports image/png and image/jpeg from clipboard.
 * Falls back gracefully if clipboard contains no image data.
 */
export function useClipboardImagePaste({ activeId, onPaste, enabled = true }: UseClipboardImagePasteOptions) {
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!enabled || !activeId) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          onPaste(activeId, file);
        }
        return;
      }
    }
  }, [activeId, onPaste, enabled]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);
}
