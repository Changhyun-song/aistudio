'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useCharacterizerStore } from '@/lib/store/characterizer-store';
import { useAppStore } from '@/lib/store';
import { ImageHoverZoom } from '@/components/shared/image-hover-zoom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { CharacterizerShot, SelectionState, StoryCharacter, CharacterVisualPrompt } from '@/types';
import { toast } from 'sonner';

const SELECTION_CONFIG: Record<SelectionState, { bg: string; label: string }> = {
  unreviewed: { bg: 'bg-zinc-600', label: 'Unreviewed' },
  keep: { bg: 'bg-green-600', label: 'Keep' },
  maybe: { bg: 'bg-yellow-600', label: 'Maybe' },
  reject: { bg: 'bg-red-600', label: 'Reject' },
};

type Section = 'setup' | 'anchors' | 'shots' | 'export';

export default function CharacterizerPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { currentProject } = useAppStore();
  const {
    config, anchors, shots, geminiConfigured, loading, generatingShots, error,
    storyCharacters, visualPrompts, activeCharacterId,
    fetchConfig, saveConfig, syncCharacter, generateAnchors, generateAllShots,
    regenerateShot, fetchShots, updateShotSelection, clearError,
  } = useCharacterizerStore();

  const [section, setSection] = useState<Section>('setup');
  const [filter, setFilter] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [characterName, setCharacterName] = useState('');
  const [signatureItem, setSignatureItem] = useState('');
  const [signatureColor, setSignatureColor] = useState('');
  const [schoolStyle, setSchoolStyle] = useState('modest Korean school uniform, blazer, white shirt, tie');
  const [afterSchoolStyle, setAfterSchoolStyle] = useState('');
  const [toneKeywords, setToneKeywords] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchConfig(projectId);
    fetchShots(projectId);
  }, [projectId, fetchConfig, fetchShots]);

  useEffect(() => {
    if (config) {
      setCharacterName(config.character_name || '');
      setSignatureItem(config.signature_item || '');
      setSignatureColor(config.signature_color || '');
      setSchoolStyle(config.school_style || 'modest Korean school uniform, blazer, white shirt, tie');
      setAfterSchoolStyle(config.after_school_style || '');
      setToneKeywords(config.tone_keywords || '');
    }
  }, [config]);

  useEffect(() => {
    if (anchors.length > 0 && !shots.length) setSection('anchors');
    if (shots.length > 0) setSection('shots');
  }, [anchors.length, shots.length]);

  const activeVisualPrompt: CharacterVisualPrompt | undefined = activeCharacterId
    ? visualPrompts.find(vp => vp.character_id === activeCharacterId)
    : undefined;

  const activeStoryChar: StoryCharacter | undefined = activeCharacterId
    ? storyCharacters.find(c => c.id === activeCharacterId)
    : undefined;

  const handleCharacterSelect = async (charId: string) => {
    await syncCharacter(projectId, charId);
  };

  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success('프롬프트 복사됨');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('복사 실패');
    }
  };

  const handleBaseImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('projectId', projectId);
    form.append('category', 'characterizer');
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    await saveConfig(projectId, { base_image_path: data.path });
    toast.success('기준 이미지 업로드 완료');
  }, [projectId, saveConfig]);

  const handleSaveConfig = async () => {
    await saveConfig(projectId, {
      character_name: characterName,
      signature_item: signatureItem,
      signature_color: signatureColor,
      school_style: schoolStyle,
      after_school_style: afterSchoolStyle,
      tone_keywords: toneKeywords,
    });
    toast.success('설정 저장됨');
  };

  const handleGenerateAnchors = async () => {
    await handleSaveConfig();
    try {
      await generateAnchors(projectId);
      toast.success('Anchor 4장 생성 완료');
      setSection('anchors');
    } catch {
      toast.error(error || 'Anchor 생성 실패');
      clearError();
    }
  };

  const handleGenerate40 = async () => {
    try {
      await generateAllShots(projectId);
      const s = useCharacterizerStore.getState();
      const completed = s.shots.filter(sh => sh.status === 'completed').length;
      const failed = s.shots.filter(sh => sh.status === 'failed').length;
      toast.success(`40-Shot 생성 완료: ${completed} 성공, ${failed} 실패`);
      setSection('shots');
    } catch {
      toast.error(error || '40-Shot 생성 실패');
      clearError();
    }
  };

  const handleRegenerate = async (shotId: string) => {
    await regenerateShot(projectId, shotId);
    toast.success('재생성 완료');
  };

  const handleSelection = async (shotId: string, state: SelectionState) => {
    await updateShotSelection(projectId, shotId, state);
  };

  const handleExportKeep = () => {
    window.open(`/api/projects/${projectId}/characterizer/export`, '_blank');
  };

  const handleExportAll = () => {
    window.open(`/api/projects/${projectId}/characterizer/export?all=1`, '_blank');
  };

  const stats = {
    total: shots.length,
    completed: shots.filter(s => s.status === 'completed').length,
    failed: shots.filter(s => s.status === 'failed').length,
    generating: shots.filter(s => s.status === 'generating').length,
    keep: shots.filter(s => s.selection_state === 'keep').length,
    maybe: shots.filter(s => s.selection_state === 'maybe').length,
    reject: shots.filter(s => s.selection_state === 'reject').length,
  };

  const filteredShots = shots.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'failed') return s.status === 'failed';
    return s.selection_state === filter;
  });

  const hasStoryChars = storyCharacters.length > 0;

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {([
          { key: 'setup', label: '1. Setup', icon: '⚙️' },
          { key: 'anchors', label: '2. Anchors', icon: '🔗', disabled: !config?.base_image_path },
          { key: 'shots', label: '3. 40 Shots', icon: '🎬', disabled: anchors.filter(a => a.status === 'completed').length === 0 },
          { key: 'export', label: '4. Export', icon: '📦', disabled: stats.completed === 0 },
        ] as { key: Section; label: string; icon: string; disabled?: boolean }[]).map(tab => (
          <Button
            key={tab.key}
            variant={section === tab.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSection(tab.key)}
            disabled={tab.disabled}
            className="text-xs"
          >
            {tab.icon} {tab.label}
          </Button>
        ))}
      </div>

      {/* ── Section 1: Setup ──────────────────────────── */}
      {section === 'setup' && (
        <div className="space-y-6">
          {/* Character Selector from Story Studio */}
          {hasStoryChars && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold">Story Studio 캐릭터</span>
                  <Badge variant="secondary" className="text-[10px]">자동 연결</Badge>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {storyCharacters.map(char => {
                    const isActive = char.id === activeCharacterId;
                    const hasPrompt = visualPrompts.some(vp => vp.character_id === char.id && vp.mj_base_prompt);
                    const isMain = char.role?.includes('메인') || char.role?.includes('주인공');
                    return (
                      <button
                        key={char.id}
                        onClick={() => handleCharacterSelect(char.id)}
                        className={cn(
                          'px-3 py-2 rounded-lg border text-left transition-all text-sm',
                          isActive
                            ? 'border-primary bg-primary/10 ring-1 ring-primary'
                            : 'border-border hover:border-primary/50 bg-card',
                        )}
                      >
                        <div className="font-medium flex items-center gap-1.5">
                          {char.name}
                          {isMain && <Badge variant="default" className="text-[9px] h-4 px-1">메인</Badge>}
                          {hasPrompt && <span className="text-green-500 text-xs">✓</span>}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 max-w-[200px] truncate">
                          {char.role}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Base Portrait Prompt (from AI) */}
          {activeVisualPrompt?.mj_base_prompt && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Base Portrait 프롬프트</span>
                    <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-400">MJ 복사용</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant={copied ? 'default' : 'outline'}
                    onClick={() => handleCopyPrompt(activeVisualPrompt.mj_base_prompt)}
                    className="h-7 text-xs"
                  >
                    {copied ? '✓ 복사됨' : '📋 복사'}
                  </Button>
                </div>
                <div className="bg-black/30 rounded-lg p-3 text-xs text-muted-foreground font-mono leading-relaxed max-h-32 overflow-y-auto">
                  {activeVisualPrompt.mj_base_prompt}
                </div>
                {activeVisualPrompt.visual_brief && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">비주얼 요약:</span> {activeVisualPrompt.visual_brief}
                  </p>
                )}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5">
                  <span>💡</span>
                  <span>위 프롬프트를 복사해서 Midjourney에서 이미지를 생성한 뒤, 아래에서 업로드하세요.</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Base Image Upload */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-1">기준 이미지</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  {hasStoryChars
                    ? 'MJ에서 생성한 캐릭터 이미지를 업로드하세요'
                    : '캐릭터 기준 이미지를 업로드하세요'}
                </p>
                {config?.base_image_path ? (
                  <div className="space-y-3">
                    <div className="aspect-[2/3] bg-muted rounded-lg overflow-hidden max-w-xs">
                      <ImageHoverZoom src={config.base_image_path} alt="Base" className="w-full h-full object-cover" />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>이미지 변경</Button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[2/3] max-w-xs rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <svg className="w-10 h-10 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="text-sm text-muted-foreground">
                      {activeVisualPrompt?.mj_base_prompt
                        ? 'MJ에서 생성한 이미지 업로드'
                        : '기준 캐릭터 이미지 업로드'}
                    </span>
                    <span className="text-xs text-muted-foreground/60">PNG, JPG</span>
                  </div>
                )}
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleBaseImageUpload} />
              </CardContent>
            </Card>

            {/* Character Settings */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">캐릭터 설정</h3>
                  {hasStoryChars && (
                    <Badge variant="secondary" className="text-[10px]">Story Studio에서 자동 채움</Badge>
                  )}
                </div>
                {!hasStoryChars && (
                  <p className="text-xs text-muted-foreground">비워두면 이미지만으로 생성합니다</p>
                )}
                <div>
                  <Label className="text-xs">캐릭터 이름</Label>
                  <Input value={characterName} onChange={e => setCharacterName(e.target.value)} placeholder="예: 하은" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">시그니처 아이템</Label>
                  <Input value={signatureItem} onChange={e => setSignatureItem(e.target.value)} placeholder="예: fluffy bear sleep mask on head" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">시그니처 컬러</Label>
                  <Input value={signatureColor} onChange={e => setSignatureColor(e.target.value)} placeholder="예: pastel lavender" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">교복 스타일</Label>
                  <Input value={schoolStyle} onChange={e => setSchoolStyle(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">방과 후 스타일</Label>
                  <Input value={afterSchoolStyle} onChange={e => setAfterSchoolStyle(e.target.value)} placeholder="예: oversized hoodie, jeans" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">톤 키워드</Label>
                  <Input value={toneKeywords} onChange={e => setToneKeywords(e.target.value)} placeholder="예: dreamy, soft, warm" className="mt-1" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveConfig} variant="outline" disabled={loading}>저장</Button>
                  <Button onClick={handleGenerateAnchors} disabled={!config?.base_image_path || loading || !geminiConfigured}>
                    {loading ? 'Anchor 생성 중...' : '🔗 Anchor 4장 생성'}
                  </Button>
                </div>
                {!geminiConfigured && (
                  <p className="text-xs text-red-400">GEMINI_API_KEY가 설정되지 않았습니다. .env.local에 추가하세요.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Workflow Guide */}
          {hasStoryChars && (
            <Card className="border-dashed">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-2">전체 워크플로우</h4>
                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                  {[
                    { step: '1', label: '캐릭터 선택', done: !!activeCharacterId },
                    { step: '2', label: 'MJ 프롬프트 복사', done: !!activeVisualPrompt?.mj_base_prompt },
                    { step: '3', label: 'MJ에서 이미지 생성', done: false },
                    { step: '4', label: '이미지 업로드', done: !!config?.base_image_path },
                    { step: '5', label: 'Anchor 4장', done: anchors.filter(a => a.status === 'completed').length === 4 },
                    { step: '6', label: '40 Shot 생성', done: stats.completed > 0 },
                  ].map((s, i) => (
                    <span key={s.step} className="flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground/40 mx-1">→</span>}
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px]',
                        s.done ? 'border-green-500/40 text-green-400 bg-green-500/10' : 'border-border',
                      )}>
                        {s.done ? '✓' : s.step}. {s.label}
                      </span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Section 2: Anchors ────────────────────────── */}
      {section === 'anchors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Anchor Shots ({anchors.filter(a => a.status === 'completed').length}/4)</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerateAnchors} disabled={loading}>
                {loading ? '재생성 중...' : '🔄 Anchor 재생성'}
              </Button>
              <Button size="sm" onClick={() => setSection('shots')} disabled={anchors.filter(a => a.status === 'completed').length === 0}>
                40-Shot 생성으로 →
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {anchors.map(anchor => (
              <Card key={anchor.id} className={cn('overflow-hidden', anchor.status === 'failed' && 'border-red-500/50')}>
                <CardContent className="p-0">
                  <div className="aspect-[2/3] bg-muted relative">
                    {anchor.file_path && anchor.status === 'completed' ? (
                      <ImageHoverZoom src={anchor.file_path} alt={anchor.label} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-sm text-muted-foreground">
                          {anchor.status === 'generating' ? '⏳ 생성 중...' : anchor.status === 'failed' ? '❌ 실패' : '⏸ 대기'}
                        </span>
                      </div>
                    )}
                    <Badge className="absolute top-1.5 left-1.5 text-[10px] h-5" variant="secondary">{anchor.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 3: 40-Shot Grid ───────────────────── */}
      {section === 'shots' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-semibold">40-Shot Generation</h3>
              {generatingShots && <p className="text-xs text-yellow-400 animate-pulse">생성 진행 중...</p>}
            </div>
            <div className="flex gap-2">
              {shots.length === 0 && (
                <Button onClick={handleGenerate40} disabled={generatingShots || loading}>
                  {generatingShots ? '생성 중...' : '⚡ Generate 40 Shots'}
                </Button>
              )}
              {stats.failed > 0 && (
                <Button variant="outline" size="sm" onClick={async () => {
                  const failedShots = shots.filter(s => s.status === 'failed');
                  for (const s of failedShots) await handleRegenerate(s.id);
                }}>
                  🔄 실패 {stats.failed}개 재시도
                </Button>
              )}
              <Button size="sm" onClick={() => setSection('export')} disabled={stats.completed < 1}>
                📦 Export →
              </Button>
            </div>
          </div>

          {shots.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <span>생성: <strong>{stats.completed}</strong>/40</span>
                {stats.failed > 0 && <span className="text-red-400">실패: {stats.failed}</span>}
                <span className="text-green-400">Keep: {stats.keep}</span>
                <span className="text-yellow-400">Maybe: {stats.maybe}</span>
                <span className="text-red-400">Reject: {stats.reject}</span>
              </div>
              <Progress value={(stats.completed / Math.max(stats.total, 1)) * 100} className="h-2" />
            </div>
          )}

          <div className="flex gap-1">
            {[
              { k: 'all', l: '전체' },
              { k: 'failed', l: '❌ 실패' },
              { k: 'keep', l: '✅ Keep' },
              { k: 'maybe', l: '🤔 Maybe' },
              { k: 'reject', l: '❌ Reject' },
              { k: 'unreviewed', l: '🔲 Unreviewed' },
            ].map(f => (
              <Button key={f.k} variant={filter === f.k ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f.k)} className="text-xs h-7">{f.l}</Button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredShots.map(shot => (
              <ShotCard
                key={shot.id}
                shot={shot}
                onRegenerate={() => handleRegenerate(shot.id)}
                onSelection={(state) => handleSelection(shot.id, state)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Section 4: Export ─────────────────────────── */}
      {section === 'export' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Dataset Export</h3>
            <p className="text-xs text-muted-foreground">Export 후에도 프로젝트 데이터는 그대로 유지됩니다</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <Card><CardContent className="p-4"><div className="text-3xl font-bold">{stats.completed}</div><div className="text-xs text-muted-foreground">Generated</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-3xl font-bold text-green-400">{stats.keep}</div><div className="text-xs text-muted-foreground">Keep</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-3xl font-bold text-yellow-400">{stats.maybe}</div><div className="text-xs text-muted-foreground">Maybe</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-3xl font-bold text-red-400">{stats.reject}</div><div className="text-xs text-muted-foreground">Reject</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-3xl font-bold text-red-500">{stats.failed}</div><div className="text-xs text-muted-foreground">Failed</div></CardContent></Card>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h4 className="font-medium">Export 옵션</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>metadata.json</strong> — 캐릭터 정보, 사용 모델, 선택된 샷 목록</li>
                <li>• <strong>prompts.txt</strong> — 40개 프롬프트 전체</li>
                <li>• <strong>anchors/</strong> — Anchor 이미지</li>
                <li>• <strong>shots/</strong> — 선택된 이미지</li>
              </ul>
              <div className="flex gap-3">
                <Button onClick={handleExportKeep} disabled={stats.keep < 1} className="flex-1">
                  📦 Keep만 다운로드 ({stats.keep}장)
                </Button>
                <Button onClick={handleExportAll} variant="outline" disabled={stats.completed < 1} className="flex-1">
                  📦 전체 다운로드 ({stats.completed - stats.reject}장, reject 제외)
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">다운로드해도 프로젝트 데이터는 삭제되지 않습니다. 언제든 돌아와서 확인할 수 있습니다.</p>
            </CardContent>
          </Card>

          {(() => {
            const previewShots = shots.filter(s => s.status === 'completed' && s.file_path && s.selection_state !== 'reject');
            if (previewShots.length === 0) return null;
            return (
              <>
                <h4 className="text-sm font-medium text-muted-foreground">Export 대상 미리보기 ({previewShots.length}장)</h4>
                <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-2">
                  {previewShots.map(shot => (
                    <div key={shot.id} className={cn(
                      'rounded-lg overflow-hidden border',
                      shot.selection_state === 'keep' ? 'border-green-500/40' : 'border-border',
                    )}>
                      <div className="aspect-[2/3] bg-muted">
                        <ImageHoverZoom src={shot.file_path} alt={shot.label} className="w-full h-full object-cover" zoomSize={400} />
                      </div>
                      <div className="p-1 text-[9px] text-muted-foreground truncate">{shot.label}</div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-900/90 text-red-100 p-3 rounded-lg text-sm max-w-sm z-50">
          {error}
          <button onClick={clearError} className="ml-2 underline">닫기</button>
        </div>
      )}
    </div>
  );
}

// ── Shot Card ────────────────────────────────────────

function ShotCard({ shot, onRegenerate, onSelection }: {
  shot: CharacterizerShot;
  onRegenerate: () => void;
  onSelection: (state: SelectionState) => void;
}) {
  const sc = SELECTION_CONFIG[shot.selection_state];
  const isCompleted = shot.status === 'completed' && shot.file_path;
  const isFailed = shot.status === 'failed';
  const isGenerating = shot.status === 'generating';
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden bg-card transition-all',
      shot.selection_state === 'keep' && 'border-green-500/40',
      shot.selection_state === 'reject' && 'opacity-40',
      isFailed && 'border-red-500/40',
    )}>
      <div className="aspect-[2/3] bg-muted relative overflow-hidden">
        {isCompleted ? (
          <ImageHoverZoom src={shot.file_path} alt={shot.label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-muted-foreground">생성 중...</span>
              </>
            ) : isFailed ? (
              <>
                <span className="text-lg">❌</span>
                <span className="text-[10px] text-red-400">실패</span>
                <button onClick={e => { e.stopPropagation(); onRegenerate(); }} className="text-[10px] text-primary hover:underline mt-1">재시도</button>
              </>
            ) : (
              <span className="text-[10px] text-muted-foreground">대기</span>
            )}
          </div>
        )}

        <div className="absolute top-1.5 left-1.5 flex gap-1">
          <Badge variant="secondary" className="text-[10px] h-5 tabular-nums">{String(shot.shot_index).padStart(2, '0')}</Badge>
          <Badge className={cn(sc.bg, 'text-white text-[10px] h-5')}>{sc.label}</Badge>
        </div>

        {isFailed && (
          <button onClick={onRegenerate} className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded">🔄</button>
        )}
      </div>

      <div className="p-2 space-y-1.5">
        <p className="text-[11px] font-medium truncate">{shot.label}</p>

        {isCompleted && (
          <div className="flex gap-1">
            {([
              { s: 'keep' as SelectionState, icon: '✅', activeBg: 'bg-green-600 text-white' },
              { s: 'maybe' as SelectionState, icon: '🤔', activeBg: 'bg-yellow-600 text-black' },
              { s: 'reject' as SelectionState, icon: '❌', activeBg: 'bg-red-600 text-white' },
            ]).map(btn => (
              <button
                key={btn.s}
                onClick={() => onSelection(btn.s)}
                className={cn(
                  'flex-1 h-6 rounded text-[10px] transition-all',
                  shot.selection_state === btn.s ? btn.activeBg : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
                )}
              >
                {btn.icon}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="text-[9px] text-muted-foreground hover:text-foreground w-full text-left truncate"
        >
          {showPrompt ? '▼ hide prompt' : '▶ show prompt'}
        </button>
        {showPrompt && (
          <div className="text-[9px] text-muted-foreground bg-muted p-1.5 rounded max-h-20 overflow-y-auto">
            {shot.prompt_used}
          </div>
        )}
      </div>
    </div>
  );
}
