'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { TWENTY_SHOTS } from '@/types';
import type { QualityCheck } from '@/types';
import { toast } from 'sonner';

const QUALITY_ITEMS: { key: keyof QualityCheck; label: string }[] = [
  { key: 'face_consistent', label: '얼굴 일관성 확인' },
  { key: 'high_resolution', label: '고화질 확인' },
  { key: 'style_consistent', label: '스타일 일관성' },
  { key: 'no_extra_people', label: '추가 인물 없음' },
  { key: 'no_text_overlay', label: '텍스트/워터마크 없음' },
  { key: 'good_lighting', label: '조명 품질' },
  { key: 'has_full_body', label: '전신 컷 2장 이상' },
  { key: 'has_side_views', label: '측면 컷 2장 이상' },
  { key: 'has_emotions', label: '감정 변화 컷 3장 이상' },
];

export default function DatasetPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { variants, fetchVariants, currentProject, baseCharacter, fetchBase } = useAppStore();
  const [showMeta, setShowMeta] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);

  useEffect(() => { fetchVariants(projectId); fetchBase(projectId); }, [projectId, fetchVariants, fetchBase]);

  const kept = variants.filter(v => v.status === 'keep' && (v.image_url || v.image_path));
  const maybe = variants.filter(v => v.status === 'maybe' && (v.image_url || v.image_path));

  const metadata = {
    character_name: currentProject?.name || '',
    concept: currentProject?.description || '',
    base_prompt: baseCharacter?.base_prompt || '',
    base_image: baseCharacter?.candidate?.image_url || baseCharacter?.candidate?.image_path || '',
    total_images: kept.length,
    shots: kept.map(v => ({ slot: v.slot, key: v.shot_key, label: v.label, image: v.image_url || v.image_path })),
    notes: `Soul ID / Soul Cinema dataset. ${kept.length} images selected.`,
    created_at: new Date().toISOString(),
  };

  const promptsTxt = variants.map(v =>
    `[${String(v.slot).padStart(2, '0')}] ${v.label}\n${v.prompt}\nStatus: ${v.status}`
  ).join('\n\n---\n\n');

  const handleExport = async () => {
    toast.info('ZIP 생성 중...');
    try {
      const res = await fetch(`/api/projects/${projectId}/export`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProject?.name || 'dataset'}_character.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('다운로드 완료');
    } catch {
      toast.error('Export 실패');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dataset</h2>
          <p className="text-muted-foreground text-sm mt-1">Soul ID / Soul Cinema 학습용 데이터셋을 정리하고 내보냅니다</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowMeta(!showMeta)}>metadata.json</Button>
          <Button variant="outline" onClick={() => setShowPrompts(!showPrompts)}>prompts.txt</Button>
          <Button onClick={handleExport} disabled={kept.length === 0}>📦 ZIP 다운로드</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                선택된 이미지 <Badge variant="secondary">{kept.length}장</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {kept.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Keep으로 표시된 이미지가 없습니다</p>
              ) : (
                <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
                  {kept.map(v => (
                    <div key={v.id} className="aspect-[2/3] bg-muted rounded overflow-hidden relative">
                      <img src={v.image_url || v.image_path} alt={v.label} className="w-full h-full object-cover" />
                      <Badge variant="secondary" className="absolute bottom-1 left-1 text-[9px] h-4">{v.slot}. {v.label}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {maybe.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Maybe <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">{maybe.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
                  {maybe.map(v => (
                    <div key={v.id} className="aspect-[2/3] bg-muted rounded overflow-hidden opacity-70">
                      <img src={v.image_url || v.image_path} alt={v.label} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">품질 체크리스트</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {QUALITY_ITEMS.map(q => (
                <div key={q.key} className="flex items-center gap-2">
                  <Checkbox id={q.key} />
                  <label htmlFor={q.key} className="text-sm">{q.label}</label>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">통계</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Keep</span><span>{kept.length}장</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Maybe</span><span>{maybe.length}장</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shot 유형</span><span>{new Set(kept.map(v => v.shot_key)).size}종</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Higgsfield 가이드</CardTitle></CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1.5">
              <p>✅ 최소 20장 이상 고화질</p>
              <p>✅ 여러 각도 (정면/측면/45도)</p>
              <p>✅ 최소 1장 전신</p>
              <p>✅ 다양한 표정</p>
              <p>✅ 일관된 인물</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {showMeta && (
        <Card>
          <CardHeader><CardTitle className="text-base">metadata.json</CardTitle></CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-md max-h-80 overflow-auto">{JSON.stringify(metadata, null, 2)}</pre>
          </CardContent>
        </Card>
      )}

      {showPrompts && (
        <Card>
          <CardHeader><CardTitle className="text-base">prompts.txt</CardTitle></CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-md max-h-80 overflow-auto">{promptsTxt}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
