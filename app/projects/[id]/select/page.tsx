'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function SelectPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const { candidates, fetchCandidates, setBase, baseCharacter, fetchBase, loading } = useAppStore();

  useEffect(() => { fetchCandidates(projectId); fetchBase(projectId); }, [projectId, fetchCandidates, fetchBase]);

  const uploaded = candidates.filter(c => c.image_url || c.image_path);

  const handleSelect = async (candidateId: string) => {
    await setBase(projectId, candidateId);
    toast.success('기준 캐릭터로 선택되었습니다');
  };

  const handleProceed = () => {
    router.push(`/projects/${projectId}/variants`);
  };

  if (uploaded.length === 0) {
    return (
      <div className="text-center py-24">
        <div className="text-6xl mb-4">📷</div>
        <h2 className="text-2xl font-semibold mb-2">업로드된 이미지가 없습니다</h2>
        <p className="text-muted-foreground mb-6">Prompt Lab에서 프롬프트를 생성하고 Midjourney 결과를 업로드하세요</p>
        <Button onClick={() => router.push(`/projects/${projectId}/prompt-lab`)}>Prompt Lab으로 이동 →</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">캐릭터 선택</h2>
          <p className="text-muted-foreground text-sm mt-1">
            업로드된 후보 중 최종 1장을 BASE CHARACTER로 선택하세요
          </p>
        </div>
        {baseCharacter && (
          <Button onClick={handleProceed}>20장 확장 생성 →</Button>
        )}
      </div>

      {baseCharacter && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="py-4 flex items-center gap-4">
            <Badge className="bg-yellow-500 text-black font-bold shrink-0">BASE</Badge>
            <p className="text-sm">기준 캐릭터가 선택되었습니다. "20장 확장 생성" 버튼을 눌러 다음 단계로 진행하세요.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {uploaded.map(c => {
          const isBase = c.is_base;
          return (
            <Card key={c.id} className={`overflow-hidden group cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${isBase ? 'ring-2 ring-yellow-500' : ''}`}>
              <CardContent className="p-0">
                <div className="aspect-[2/3] bg-muted relative overflow-hidden">
                  <img src={c.image_url || c.image_path} alt="" className="w-full h-full object-cover" />
                  {isBase && (
                    <Badge className="absolute top-2 left-2 bg-yellow-500 text-black font-bold">BASE</Badge>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <Button
                      className={`opacity-0 group-hover:opacity-100 transition-opacity ${isBase ? 'bg-yellow-500 text-black hover:bg-yellow-400' : ''}`}
                      onClick={() => handleSelect(c.id)}
                      disabled={loading}
                    >
                      {isBase ? '✓ 선택됨' : '이 캐릭터로 확정'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
