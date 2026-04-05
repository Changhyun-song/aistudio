'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { CharacterBrief } from '@/types';
import { DEFAULT_BRIEF } from '@/types';

type FormData = Omit<CharacterBrief, 'id' | 'project_id' | 'created_at' | 'updated_at'>;

export default function BriefPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const { brief, fetchBrief, saveBrief, aiGenerate, checkAI, aiConfigured, structureBrief, loading, error, clearError } = useAppStore();
  const [form, setForm] = useState<FormData>({ ...DEFAULT_BRIEF });
  const [naturalMode, setNaturalMode] = useState(true);
  const [structuring, setStructuring] = useState(false);

  useEffect(() => { fetchBrief(projectId); checkAI(); }, [projectId, fetchBrief, checkAI]);
  useEffect(() => {
    if (brief) {
      setForm({
        natural_input: brief.natural_input, name: brief.name, gender: brief.gender,
        age_group: brief.age_group, face_keywords: brief.face_keywords, hairstyle: brief.hairstyle,
        hair_color: brief.hair_color, body_type: brief.body_type, mood: brief.mood,
        personality: brief.personality, signature_item: brief.signature_item,
        signature_color: brief.signature_color, uniform_style: brief.uniform_style,
        casual_style: brief.casual_style, negative_prompts: brief.negative_prompts,
        prompt_strength: brief.prompt_strength,
      });
      if (brief.face_keywords || brief.hairstyle) setNaturalMode(false);
    }
  }, [brief]);

  const u = (key: keyof FormData, val: string | null) => setForm(p => ({ ...p, [key]: val ?? '' }));

  const handleStructure = async () => {
    if (!form.natural_input.trim()) return;
    setStructuring(true);
    try {
      const data = await structureBrief(form.natural_input);
      setForm(p => ({
        ...p,
        name: data.name || p.name,
        gender: (data.gender as FormData['gender']) || p.gender,
        face_keywords: data.face_keywords || p.face_keywords,
        hairstyle: data.hairstyle || p.hairstyle,
        hair_color: data.hair_color || p.hair_color,
        body_type: data.body_type || p.body_type,
        mood: data.mood || p.mood,
        personality: data.personality || p.personality,
        signature_item: data.signature_item || p.signature_item,
        signature_color: data.signature_color || p.signature_color,
        uniform_style: data.uniform_style || p.uniform_style,
        casual_style: data.casual_style || p.casual_style,
      }));
      setNaturalMode(false);
      toast.success('AI가 캐릭터 정보를 구조화했습니다');
    } catch {
      toast.error('구조화 실패. API 키를 확인하세요.');
    }
    setStructuring(false);
  };

  const handleSave = async () => {
    await saveBrief(projectId, form);
    toast.success('저장되었습니다');
  };

  const handleGenerate = async () => {
    await saveBrief(projectId, form);
    try {
      await aiGenerate(projectId);
      toast.success('프롬프트가 생성되었습니다');
      router.push(`/projects/${projectId}/prompt-lab`);
    } catch {
      toast.error(error || '프롬프트 생성 실패');
      clearError();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Character Brief</h2>
          <p className="text-muted-foreground text-sm mt-1">
            캐릭터를 자연어로 설명하거나, 폼에 직접 입력하세요
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!aiConfigured && <Badge variant="secondary" className="bg-yellow-600 text-white">API 키 미설정 (Fallback 모드)</Badge>}
          <Button variant="outline" onClick={handleSave}>저장</Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? '생성 중...' : 'AI 프롬프트 생성 →'}
          </Button>
        </div>
      </div>

      {/* Natural Language Input */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            자연어 입력
            {aiConfigured && <Badge variant="secondary" className="bg-green-700 text-white text-[10px]">AI Ready</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={form.natural_input}
            onChange={e => u('natural_input', e.target.value)}
            placeholder="예: 늘 졸린 느낌인데 곰돌이 수면안대를 머리에 올리고 다니는 조용한 여고생. 긴 생머리에 은은한 라벤더 색감. 교실에서 창밖 보며 꾸벅꾸벅 조는 이미지."
            rows={4}
            className="text-base"
          />
          <div className="flex gap-2">
            {aiConfigured && (
              <Button variant="outline" onClick={handleStructure} disabled={structuring || !form.natural_input.trim()}>
                {structuring ? 'AI 분석 중...' : '🤖 AI로 구조화'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setNaturalMode(!naturalMode)}>
              {naturalMode ? '상세 폼 열기 ↓' : '상세 폼 닫기 ↑'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Structured Form */}
      {!naturalMode && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">기본 정보</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>캐릭터 이름 (선택)</Label>
                <Input value={form.name} onChange={e => u('name', e.target.value)} placeholder="예: 하은" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>성별</Label>
                  <Select value={form.gender} onValueChange={v => u('gender', v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">남성</SelectItem>
                      <SelectItem value="female">여성</SelectItem>
                      <SelectItem value="neutral">중성적</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>연령대</Label>
                  <Input value={form.age_group} onChange={e => u('age_group', e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>얼굴 키워드</Label>
                <Input value={form.face_keywords} onChange={e => u('face_keywords', e.target.value)} placeholder="예: soft round face, droopy eyes, sleepy look" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>헤어스타일</Label>
                  <Input value={form.hairstyle} onChange={e => u('hairstyle', e.target.value)} placeholder="예: long straight hair" className="mt-1" />
                </div>
                <div>
                  <Label>헤어 컬러</Label>
                  <Input value={form.hair_color} onChange={e => u('hair_color', e.target.value)} placeholder="예: soft lavender" className="mt-1" />
                </div>
              </div>
              <div>
                <Label>체형/비율</Label>
                <Input value={form.body_type} onChange={e => u('body_type', e.target.value)} placeholder="예: petite, slim" className="mt-1" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">무드 & 아이덴티티</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>분위기</Label>
                  <Input value={form.mood} onChange={e => u('mood', e.target.value)} placeholder="예: dreamy, soft" className="mt-1" />
                </div>
                <div>
                  <Label>성격</Label>
                  <Input value={form.personality} onChange={e => u('personality', e.target.value)} placeholder="예: quiet, introverted" className="mt-1" />
                </div>
              </div>
              <div>
                <Label>시그니처 아이템</Label>
                <Input value={form.signature_item} onChange={e => u('signature_item', e.target.value)} placeholder="예: fluffy bear sleep mask on head" className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">모든 프롬프트에 자동 포함됩니다</p>
              </div>
              <div>
                <Label>시그니처 컬러</Label>
                <Input value={form.signature_color} onChange={e => u('signature_color', e.target.value)} placeholder="예: soft lavender" className="mt-1" />
              </div>
              <Separator />
              <div>
                <Label>교복 스타일</Label>
                <Input value={form.uniform_style} onChange={e => u('uniform_style', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>방과 후 캐주얼</Label>
                <Input value={form.casual_style} onChange={e => u('casual_style', e.target.value)} placeholder="예: oversized pastel hoodie, soft pants" className="mt-1" />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">프롬프트 설정</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>프롬프트 강도</Label>
                <Select value={form.prompt_strength} onValueChange={v => u('prompt_strength', v)}>
                  <SelectTrigger className="mt-1 w-72"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">보수적 (stylize 30~38)</SelectItem>
                    <SelectItem value="medium">중간 (stylize 35~45)</SelectItem>
                    <SelectItem value="strong">강함 (stylize 42~50)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>금지 요소</Label>
                <Textarea value={form.negative_prompts} onChange={e => u('negative_prompts', e.target.value)} className="mt-1 font-mono text-sm" rows={2} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
