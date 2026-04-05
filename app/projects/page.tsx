'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { ProjectMode } from '@/types';

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

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, fetchProjects, createProject, deleteProject } = useAppStore();
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newMode, setNewMode] = useState<ProjectMode>('midjourney_manual');
  const [open, setOpen] = useState(false);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const p = await createProject(newName, newDesc, newMode);
    setNewName(''); setNewDesc(''); setNewMode('midjourney_manual'); setOpen(false);
    const dest = p.mode === 'story_studio'
      ? `/projects/${p.id}/story-studio`
      : p.mode === 'characterizer_40'
        ? `/projects/${p.id}/characterizer`
        : `/projects/${p.id}/brief`;
    router.push(dest);
  };

  const getProjectLink = (p: { id: string; mode?: string }) => {
    if (p.mode === 'story_studio') return `/projects/${p.id}/story-studio`;
    if (p.mode === 'characterizer_40') return `/projects/${p.id}/characterizer`;
    return `/projects/${p.id}/brief`;
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">CharaCraft</h1>
            <p className="text-xs text-muted-foreground">AI Character Pipeline Studio</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>+ 새 캐릭터</DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>새 캐릭터 프로젝트</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {/* Mode Selection */}
                <div>
                  <Label className="mb-2 block">파이프라인 모드</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setNewMode('midjourney_manual')}
                      className={`rounded-lg border-2 p-4 text-left transition-all ${newMode === 'midjourney_manual' ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-border/80'}`}
                    >
                      <div className="text-sm font-semibold mb-1">🎨 MJ Manual</div>
                      <div className="text-xs text-muted-foreground">AI 프롬프트 → MJ 수동 실행 → 20샷 확장</div>
                    </button>
                    <button
                      onClick={() => setNewMode('characterizer_40')}
                      className={`rounded-lg border-2 p-4 text-left transition-all ${newMode === 'characterizer_40' ? 'border-purple-500 bg-purple-500/10' : 'border-border hover:border-border/80'}`}
                    >
                      <div className="text-sm font-semibold mb-1">⚡ 40-Shot Auto</div>
                      <div className="text-xs text-muted-foreground">기준 이미지 1장 → Nano Banana 2로 40샷 생성</div>
                    </button>
                    <button
                      onClick={() => setNewMode('story_studio')}
                      className={`rounded-lg border-2 p-4 text-left transition-all ${newMode === 'story_studio' ? 'border-emerald-500 bg-emerald-500/10' : 'border-border hover:border-border/80'}`}
                    >
                      <div className="text-sm font-semibold mb-1">🎬 Story Studio</div>
                      <div className="text-xs text-muted-foreground">시리즈 기획 → Higgsfield 영상 프롬프트 생성</div>
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
              return (
                <Card key={p.id} className="hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => router.push(getProjectLink(p))}>
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
    </div>
  );
}
