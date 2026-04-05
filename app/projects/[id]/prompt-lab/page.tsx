'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export default function PromptLabPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    revisions, fetchRevisions, aiGenerate, aiRevise, aiConfigured,
    candidates, fetchCandidates, addCandidate,
    loading, error, clearError, checkAI,
  } = useAppStore();

  const [feedback, setFeedback] = useState('');

  useEffect(() => { fetchRevisions(projectId); fetchCandidates(projectId); checkAI(); }, [projectId, fetchRevisions, fetchCandidates, checkAI]);

  const latestRevision = revisions.length > 0 ? revisions[revisions.length - 1] : null;

  const handleGenerate = async () => {
    try {
      await aiGenerate(projectId);
      toast.success('프롬프트가 생성되었습니다');
    } catch {
      toast.error(error || '생성 실패');
      clearError();
    }
  };

  const handleRevise = async () => {
    if (!feedback.trim()) return;
    try {
      await aiRevise(projectId, feedback);
      setFeedback('');
      toast.success('수정 프롬프트가 생성되었습니다');
    } catch {
      toast.error(error || '수정 실패');
      clearError();
    }
  };

  const copyPrompt = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('프롬프트가 클립보드에 복사되었습니다');
  };

  const handleImageUpload = useCallback(async (file: File) => {
    if (!latestRevision) return;
    const form = new FormData();
    form.append('file', file);
    form.append('projectId', projectId);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    await addCandidate(projectId, latestRevision.id, data.path);
    toast.success('이미지가 업로드되었습니다');
  }, [projectId, latestRevision, addCandidate]);

  const handleImageUrl = useCallback(async (url: string) => {
    if (!latestRevision || !url) return;
    const c = await addCandidate(projectId, latestRevision.id);
    const { updateCandidate } = useAppStore.getState();
    await updateCandidate(projectId, c.id, { image_url: url, status: 'uploaded' });
    toast.success('이미지 URL이 등록되었습니다');
  }, [projectId, latestRevision, addCandidate]);

  const [urlInput, setUrlInput] = useState('');
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Prompt Lab</h2>
          <p className="text-muted-foreground text-sm mt-1">
            AI가 생성한 프롬프트를 확인하고, Midjourney에서 실행한 뒤 결과를 업로드하세요
          </p>
        </div>
        <div className="flex gap-2">
          {candidates.filter(c => c.image_url || c.image_path).length > 0 && (
            <Button onClick={() => router.push(`/projects/${projectId}/select`)}>
              후보 선택하러 가기 →
            </Button>
          )}
        </div>
      </div>

      {!latestRevision ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">아직 생성된 프롬프트가 없습니다</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => router.push(`/projects/${projectId}/brief`)}>Brief 작성하기</Button>
              <Button variant="outline" onClick={handleGenerate} disabled={loading}>
                {loading ? '생성 중...' : 'AI 프롬프트 생성'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Prompt */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">현재 프롬프트</CardTitle>
                  <Badge variant="secondary">v{latestRevision.version}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-md max-h-48 overflow-auto leading-relaxed">
                  {latestRevision.prompt}
                </pre>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => copyPrompt(latestRevision.prompt)}>📋 프롬프트 복사</Button>
                  <Button variant="outline" onClick={() => window.open('https://www.midjourney.com/imagine', '_blank')}>
                    Midjourney Create ↗
                  </Button>
                  <Button variant="outline" onClick={() => window.open('https://discord.gg/F5xayuq2', '_blank')}>
                    Discord 서버 ↗
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  프롬프트를 복사한 뒤 Midjourney 웹 Create 페이지 또는 Discord 서버에서 <code>/imagine</code>으로 실행하세요
                </p>
              </CardContent>
            </Card>

            {/* Feedback & Revise */}
            <Card>
              <CardHeader><CardTitle className="text-base">보완 요청</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="예: 헤어를 좀 더 짧게, 안경을 둥근 프레임으로 바꿔줘. 표정을 좀 더 나른하게."
                  rows={3}
                />
                <Button onClick={handleRevise} disabled={loading || !feedback.trim()}>
                  {loading ? '수정 중...' : '🔄 수정 프롬프트 생성'}
                </Button>
              </CardContent>
            </Card>

            {/* Upload Result */}
            <Card>
              <CardHeader><CardTitle className="text-base">결과 이미지 업로드</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleImageUpload(f); }}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                >
                  <label className="cursor-pointer block">
                    <input type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                    <p className="text-muted-foreground">이미지를 드래그하거나 클릭하여 업로드</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP</p>
                  </label>
                </div>
                <div className="flex gap-2">
                  <input
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="또는 이미지 URL 붙여넣기..."
                    className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  />
                  <Button size="sm" variant="outline" disabled={!urlInput} onClick={() => { handleImageUrl(urlInput); setUrlInput(''); }}>추가</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: Revision History & Uploaded Images */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">수정 이력</CardTitle></CardHeader>
              <CardContent className="space-y-3 max-h-64 overflow-auto">
                {revisions.map(r => (
                  <div key={r.id} className={`p-2 rounded-md text-sm cursor-pointer transition-colors ${r.id === latestRevision.id ? 'bg-primary/10 border border-primary/30' : 'bg-muted hover:bg-muted/80'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <Badge variant="secondary" className="text-[10px]">v{r.version}</Badge>
                      <span className="text-[10px] text-muted-foreground">{r.created_at.split(' ')[1]?.slice(0, 5)}</span>
                    </div>
                    {r.user_feedback && <p className="text-xs text-muted-foreground italic">"{r.user_feedback}"</p>}
                    <p className="text-xs truncate mt-1">{r.prompt.slice(0, 60)}...</p>
                  </div>
                ))}
                {revisions.length === 0 && <p className="text-xs text-muted-foreground">이력 없음</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  업로드된 이미지
                  <Badge variant="secondary">{candidates.filter(c => c.image_url || c.image_path).length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {candidates.filter(c => c.image_url || c.image_path).map(c => (
                    <div key={c.id} className="aspect-[2/3] bg-muted rounded-md overflow-hidden relative group">
                      <img src={c.image_url || c.image_path} alt="" className="w-full h-full object-cover" />
                      {c.is_base && (
                        <Badge className="absolute top-1 left-1 bg-yellow-500 text-black text-[10px]">BASE</Badge>
                      )}
                    </div>
                  ))}
                </div>
                {candidates.filter(c => c.image_url || c.image_path).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">아직 업로드된 이미지가 없습니다</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
