'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface PromptDisplayProps {
  prompt: string;
  onEdit?: (newPrompt: string) => void;
  compact?: boolean;
}

export function PromptDisplay({ prompt, onEdit, compact }: PromptDisplayProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(prompt);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(prompt);
    toast.success('프롬프트가 복사되었습니다');
  };

  if (compact) {
    return (
      <Dialog>
        <DialogTrigger render={<button className="text-xs text-muted-foreground hover:text-foreground truncate max-w-full text-left transition-colors" />}>
          {prompt.slice(0, 60)}...
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prompt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {editing ? (
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-md">{prompt}</pre>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyToClipboard}>Copy</Button>
              {onEdit && !editing && (
                <Button size="sm" variant="outline" onClick={() => { setEditing(true); setEditValue(prompt); }}>Edit</Button>
              )}
              {editing && (
                <>
                  <Button size="sm" onClick={() => { onEdit?.(editValue); setEditing(false); }}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-2">
      <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-md max-h-48 overflow-auto">
        {prompt}
      </pre>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={copyToClipboard}>Copy</Button>
        {onEdit && (
          <Button size="sm" variant="outline" onClick={() => onEdit(prompt)}>Edit</Button>
        )}
      </div>
    </div>
  );
}
