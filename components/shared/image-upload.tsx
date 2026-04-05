'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  projectId: string;
  onUploaded: (path: string) => void;
  className?: string;
  compact?: boolean;
}

export function ImageUpload({ projectId, onUploaded, className, compact }: ImageUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrl, setShowUrl] = useState(false);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('projectId', projectId);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      onUploaded(data.path);
    } finally {
      setUploading(false);
    }
  }, [projectId, onUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }, [upload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
  }, [upload]);

  if (compact) {
    return (
      <div className={cn('flex gap-2', className)}>
        <label className="cursor-pointer">
          <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
          <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 py-1 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
            {uploading ? 'Uploading...' : 'Upload'}
          </span>
        </label>
        {!showUrl ? (
          <Button size="sm" variant="ghost" onClick={() => setShowUrl(true)}>URL</Button>
        ) : (
          <div className="flex gap-1">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Image URL..."
              className="h-8 text-xs w-48"
            />
            <Button size="sm" variant="outline" onClick={() => { onUploaded(urlInput); setUrlInput(''); setShowUrl(false); }}>
              OK
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          uploading && 'opacity-50 pointer-events-none'
        )}
      >
        <label className="cursor-pointer block">
          <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} multiple={false} />
          <div className="text-muted-foreground">
            <p className="text-lg mb-1">{uploading ? '업로드 중...' : '이미지를 드래그하거나 클릭'}</p>
            <p className="text-xs">PNG, JPG, WEBP</p>
          </div>
        </label>
      </div>
      <div className="mt-3 flex gap-2 items-center">
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="또는 이미지 URL 붙여넣기..."
          className="text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!urlInput}
          onClick={() => { onUploaded(urlInput); setUrlInput(''); }}
        >
          추가
        </Button>
      </div>
    </div>
  );
}
