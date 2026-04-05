'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useStoryStore } from '@/lib/store/story-store';
import { useAppStore } from '@/lib/store';
import { ProjectNav } from '@/components/layout/project-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { StoryCharacter, GenreOverlay, GenreTag, StoryCentralAxis, VideoProvider, CharacterVisualPrompt } from '@/types';
import { GENRE_TAGS, GENRE_PRESETS, DEFAULT_GENRE_OVERLAY, COMPOSITION_RULES, CENTRAL_AXES, VIDEO_PROVIDERS } from '@/types';
import { EvaluationPanel } from '@/components/story/evaluation-panel';
import { PipelineProgress } from '@/components/story/pipeline-progress';

type MainTab = 'architect' | 'screenplay' | 'designer';

const MAIN_TABS: { key: MainTab; label: string; ai: string }[] = [
  { key: 'architect', label: 'Story Architect', ai: 'AI 1' },
  { key: 'screenplay', label: 'Screenplay Director', ai: 'AI 2' },
  { key: 'designer', label: 'Frame & Video Designer', ai: 'AI 3' },
];

export default function StoryStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const { projects, fetchProjects } = useAppStore();
  const store = useStoryStore();
  const [tab, setTab] = useState<MainTab>('architect');
  const project = projects.find(p => p.id === projectId);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => {
    store.fetchCharacters(projectId);
    store.fetchConcept(projectId);
    store.fetchBible(projectId);
    store.fetchSeason(projectId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div className="min-h-screen flex flex-col">
      <ProjectNav projectId={projectId} projectName={project?.name || 'Story Studio'} mode="story_studio" />

      {/* Main Tab Bar */}
      <div className="border-b border-border bg-card/30">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {MAIN_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                tab === t.key ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Badge variant="outline" className="text-[10px] px-1.5">{t.ai}</Badge>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error / Generating */}
      {store.error && (
        <div className="bg-destructive/20 border-b border-destructive/50 px-4 py-2 text-sm text-destructive flex items-center justify-between">
          <span>{store.error}</span>
          <Button variant="ghost" size="sm" onClick={store.clearError}>닫기</Button>
        </div>
      )}
      {store.generating && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-2 text-sm text-emerald-400 text-center animate-pulse">
          AI 생성 중... ({store.generating})
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full space-y-4">
        <PipelineProgress projectId={projectId} />
        {tab === 'architect' && <ArchitectTab projectId={projectId} />}
        {tab === 'screenplay' && <ScreenplayTab projectId={projectId} />}
        {tab === 'designer' && <DesignerTab projectId={projectId} />}
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// TAB 1: Story Architect (AI 1)
// ══════════════════════════════════════════════════════════

function ArchitectTab({ projectId }: { projectId: string }) {
  const { characters, addCharacter, updateCharacter, deleteCharacter, extractCharactersFromConcept, concept, generating, generateConcept, reviseConcept, pipelineRunning, runFullPipeline } = useStoryStore();
  const [subTab, setSubTab] = useState<'characters' | 'concept'>('concept');
  const [charForm, setCharForm] = useState<Partial<StoryCharacter>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [expandedChar, setExpandedChar] = useState<string | null>(null);

  const [form, setForm] = useState({
    raw_input: '', genre: '', tone: '', world_keywords: '',
    romance_level: 'medium', mystery_level: 'medium', action_level: 'medium',
    ending_mood: '', target_audience: '',
  });
  const [overlay, setOverlay] = useState<GenreOverlay>({ ...DEFAULT_GENRE_OVERLAY });
  const [feedback, setFeedback] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [suggestions, setSuggestions] = useState<{ must_have: string[]; forbidden: string[]; nice_to_have: string[]; required_characters: string[]; optional_characters: string[] } | null>(null);
  const [userEdited, setUserEdited] = useState<Set<string>>(new Set());
  const [templateName, setTemplateName] = useState('');
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [pipelineTargetScore, setPipelineTargetScore] = useState(3.7);
  const [pipelineMaxRetries, setPipelineMaxRetries] = useState(10);
  const [visualPrompts, setVisualPrompts] = useState<CharacterVisualPrompt[]>([]);
  const [generatingVisuals, setGeneratingVisuals] = useState<string | null>(null);
  const [expandedVisual, setExpandedVisual] = useState<string | null>(null);

  useEffect(() => {
    if (characters.length > 0) {
      fetch(`/api/projects/${projectId}/story/characters/visual-prompts`)
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setVisualPrompts(data); })
        .catch(() => {});
    }
  }, [characters.length, projectId]);

  const handleGenerateAllVisuals = async () => {
    setGeneratingVisuals('batch');
    try {
      const res = await fetch(`/api/projects/${projectId}/story/characters/visual-prompts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'batch' }),
      });
      const data = await res.json();
      if (data.prompts) setVisualPrompts(data.prompts);
    } catch { /* ignore */ }
    setGeneratingVisuals(null);
  };

  const handleGenerateSingleVisual = async (characterId: string) => {
    setGeneratingVisuals(characterId);
    try {
      const res = await fetch(`/api/projects/${projectId}/story/characters/visual-prompts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single', characterId }),
      });
      const data = await res.json();
      if (data.id) {
        setVisualPrompts(prev => {
          const idx = prev.findIndex(p => p.character_id === characterId);
          if (idx >= 0) return [...prev.slice(0, idx), data, ...prev.slice(idx + 1)];
          return [...prev, data];
        });
      }
    } catch { /* ignore */ }
    setGeneratingVisuals(null);
  };

  useEffect(() => {
    if (concept) {
      setForm({
        raw_input: concept.raw_input, genre: concept.genre, tone: concept.tone,
        world_keywords: concept.world_keywords, romance_level: concept.romance_level,
        mystery_level: concept.mystery_level, action_level: concept.action_level,
        ending_mood: concept.ending_mood, target_audience: concept.target_audience,
      });
      if (concept.genre_overlay_json) {
        try {
          const parsed = JSON.parse(concept.genre_overlay_json);
          if (parsed?.genre_stack?.length) {
            if (parsed.protagonist_gender_rule && !parsed.protagonist_composition) {
              parsed.protagonist_composition = parsed.protagonist_gender_rule;
            }
            setOverlay({ ...DEFAULT_GENRE_OVERLAY, ...parsed });
            setAutoFilled(true);
          }
        } catch { /* empty */ }
      }
    }
  }, [concept]);

  const applyPreset = (presetKey: string) => {
    const preset = GENRE_PRESETS.find(p => p.key === presetKey);
    if (preset) {
      setOverlay({ ...preset.overlay });
      setForm(prev => ({
        ...prev,
        genre: preset.overlay.genre_stack.join(', '),
        tone: preset.overlay.tone,
        target_audience: preset.overlay.target_audience,
        ending_mood: preset.overlay.ending_type,
      }));
      setAutoFilled(true);
      setAdvancedOpen(true);
      setUserEdited(new Set());
      setSuggestions(null);
    }
  };

  const handleAutoFill = async () => {
    if (!form.raw_input.trim()) return;
    setAutoFilling(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/story/auto-fill`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_idea: form.raw_input }),
      });
      if (!res.ok) throw new Error('Auto-fill failed');
      const data = await res.json();
      if (data.overlay) {
        setOverlay(prev => {
          const next = { ...DEFAULT_GENRE_OVERLAY, ...data.overlay };
          for (const k of userEdited) { (next as unknown as Record<string, unknown>)[k] = (prev as unknown as Record<string, unknown>)[k]; }
          return next;
        });
        setForm(prev => ({
          ...prev,
          genre: data.overlay.genre_stack?.join(', ') || prev.genre,
          tone: data.overlay.tone || prev.tone,
          target_audience: data.overlay.target_audience || prev.target_audience,
          ending_mood: data.overlay.ending_type || prev.ending_mood,
        }));
      }
      if (data.suggestions) setSuggestions(data.suggestions);
      setAutoFilled(true);
      setAdvancedOpen(true);
    } catch { /* ignore */ }
    setAutoFilling(false);
  };

  const trackEdit = (field: string) => setUserEdited(prev => new Set(prev).add(field));

  const setOverlayTracked = (field: string, value: unknown) => {
    trackEdit(field);
    setOverlay(p => ({ ...p, [field]: value }));
  };

  const toggleGenre = (tag: GenreTag) => {
    trackEdit('genre_stack');
    setOverlay(prev => ({
      ...prev,
      genre_stack: prev.genre_stack.includes(tag)
        ? prev.genre_stack.filter(g => g !== tag)
        : [...prev.genre_stack, tag],
    }));
  };

  const addSuggestion = (type: 'must_have_elements' | 'forbidden_elements' | 'nice_to_have_elements' | 'required_character_types' | 'optional_character_types', value: string) => {
    setOverlay(p => {
      const arr = [...(p[type] || [])];
      if (!arr.includes(value)) arr.push(value);
      return { ...p, [type]: arr };
    });
  };

  const handleQuickRevision = (cmd: string) => {
    reviseConcept(projectId, cmd);
  };

  const savedTemplates = (): { name: string; overlay: GenreOverlay }[] => {
    try { return JSON.parse(localStorage.getItem('story_templates') || '[]'); } catch { return []; }
  };
  const saveTemplate = () => {
    if (!templateName.trim()) return;
    const templates = savedTemplates();
    templates.push({ name: templateName.trim(), overlay: { ...overlay } });
    localStorage.setItem('story_templates', JSON.stringify(templates));
    setTemplateName(''); setShowTemplateSave(false);
  };
  const loadTemplate = (tmpl: { name: string; overlay: GenreOverlay }) => {
    setOverlay({ ...DEFAULT_GENRE_OVERLAY, ...tmpl.overlay });
    setAutoFilled(true);
    setUserEdited(new Set());
  };
  const deleteTemplate = (name: string) => {
    const templates = savedTemplates().filter(t => t.name !== name);
    localStorage.setItem('story_templates', JSON.stringify(templates));
  };

  const handleAddChar = async () => {
    if (!charForm.name?.trim()) return;
    await addCharacter(projectId, charForm);
    setCharForm({});
  };

  const handleUpdateChar = async (id: string) => {
    await updateCharacter(projectId, id, charForm);
    setEditing(null); setCharForm({});
  };

  const mainChars = characters.filter(c => c.role && (c.role.includes('메인') || c.role.toLowerCase().includes('main') || c.role.toLowerCase().includes('hero')));
  const supportChars = characters.filter(c => {
    if (!c.role) return false;
    const r = c.role.toLowerCase();
    if (r.includes('메인') || r.includes('main') || r.includes('hero')) return false;
    if (r.includes('minor') || r.includes('마이너') || r.includes('단역')) return false;
    return true;
  });
  const minorChars = characters.filter(c => {
    if (!c.role) return true;
    const r = c.role.toLowerCase();
    if (r.includes('메인') || r.includes('main') || r.includes('hero')) return false;
    if (r.includes('minor') || r.includes('마이너') || r.includes('단역')) return true;
    return false;
  });

  const QUICK_REVISIONS = [
    { label: '더 어둡게', cmd: '전체적인 톤을 더 어둡고 무거운 분위기로 바꿔줘. 비극성과 긴장감을 높여줘.' },
    { label: '로맨스 강화', cmd: '로맨스 요소를 더 강화해줘. 감정선과 관계 갈등을 더 깊이 설계해줘.' },
    { label: '조연 추가', cmd: '조연 캐릭터를 1~2명 더 추가해줘. 서사적으로 기능하는 개별 캐릭터로.' },
    { label: '반전 강화', cmd: '반전 장치를 더 강화해줘. 예측 불가능한 트위스트를 추가해줘.' },
    { label: '코미디 줄이기', cmd: '코미디 요소를 줄이고 진지한 톤으로 전환해줘.' },
    { label: '액션 강화', cmd: '액션 장면과 긴장감 있는 장면을 더 추가해줘.' },
    { label: '더 독특하게', cmd: '스토리를 더 독특하고 예측 불가능하게 만들어줘. 기존 장르 문법에서 벗어난 고유 장치를 넣어줘.' },
    { label: '캐릭터 차별화', cmd: '메인 캐릭터들의 성격/능력/동기를 더 뚜렷하게 차별화해줘.' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border pb-2">
        <Button variant={subTab === 'concept' ? 'default' : 'outline'} size="sm" onClick={() => setSubTab('concept')}>스토리 컨셉</Button>
        <Button variant={subTab === 'characters' ? 'default' : 'outline'} size="sm" onClick={() => setSubTab('characters')}>
          등장인물 ({characters.length}/{overlay.cast_total_limit || 10})
          {concept?.approved_markdown && characters.length === 0 && <span className="ml-1 text-yellow-400">●</span>}
        </Button>
      </div>

      {subTab === 'concept' && (
        <div className="space-y-4">

          {/* ═══ STEP 1: 아이디어 입력 ═══ */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">1. 아이디어 입력</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={form.raw_input} onChange={e => setForm(p => ({ ...p, raw_input: e.target.value }))} rows={3}
                placeholder="아이디어를 자유롭게 적어주세요. 예: 외계 신호를 받은 고등학생들의 SF 스릴러, 요리 대결하는 직장인 5명의 코미디 성장기..."
              />
              <div className="flex flex-wrap gap-2 items-center">
                {GENRE_PRESETS.map(p => (
                  <button key={p.key} onClick={() => applyPreset(p.key)}
                    className="px-3 py-1.5 text-xs border border-border rounded-full hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-colors"
                    title={p.description}>
                    {p.label}
                  </button>
                ))}
                <Button variant="ghost" size="sm" onClick={() => { setOverlay({ ...DEFAULT_GENRE_OVERLAY }); setAutoFilled(false); setSuggestions(null); setUserEdited(new Set()); setAdvancedOpen(false); }} className="text-xs text-muted-foreground ml-auto">
                  초기화
                </Button>
              </div>
              {form.raw_input.trim().length > 5 && !autoFilled && (
                <Button onClick={handleAutoFill} disabled={autoFilling} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  {autoFilling ? 'AI가 설정을 분석 중...' : 'AI로 상세 설정 자동 채우기'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* ═══ STEP 2: 상세 설정 (AI 자동 채움 후 펼침) ═══ */}
          {autoFilled && (
            <Card className={advancedOpen ? 'border-emerald-500/20' : ''}>
              <CardHeader className="pb-2 cursor-pointer" onClick={() => setAdvancedOpen(!advancedOpen)}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="text-xs">{advancedOpen ? '▼' : '▶'}</span>
                    2. 상세 설정 확인 & 수정
                    <Badge variant="secondary" className="text-[10px]">AI 자동 채움 완료</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {userEdited.size > 0 && <Badge variant="outline" className="text-[10px] text-emerald-400">{userEdited.size}개 수정됨</Badge>}
                    <Button onClick={e => { e.stopPropagation(); handleAutoFill(); }} disabled={autoFilling} variant="ghost" size="sm" className="text-xs text-muted-foreground">
                      {autoFilling ? '분석 중...' : 'AI 다시 분석'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {advancedOpen && (
                <CardContent className="space-y-4 pt-2">
                  {/* Summary Badges */}
                  <div className="flex flex-wrap gap-1.5 p-3 bg-accent/30 rounded text-xs">
                    {overlay.genre_stack.map(g => <Badge key={g} className="bg-emerald-600 text-white">{g}</Badge>)}
                    {overlay.story_central_axis && overlay.story_central_axis !== 'unspecified' && <Badge className="bg-violet-600 text-white">{overlay.story_central_axis} 중심</Badge>}
                    {overlay.protagonist_count > 0 && <Badge variant="outline">{overlay.protagonist_count}인</Badge>}
                    {(overlay.protagonist_composition ?? 'unspecified') !== 'unspecified' && <Badge variant="outline">{COMPOSITION_RULES.find(r => r.key === overlay.protagonist_composition)?.label}</Badge>}
                    <Badge variant="outline">{overlay.ending_type}</Badge>
                    <Badge variant="outline">{overlay.episode_count ?? 10}부작 x {overlay.runtime_per_episode ?? 5}분</Badge>
                    {overlay.death_event !== 'none' && <Badge variant="outline" className="text-red-400 border-red-500/30">death: {overlay.death_event}</Badge>}
                    {overlay.creature_usage !== 'none' && <Badge variant="outline" className="text-purple-400 border-purple-500/30">creature: {overlay.creature_usage}</Badge>}
                    {overlay.power_system_usage !== 'none' && <Badge variant="outline" className="text-blue-400 border-blue-500/30">power: {overlay.power_system_usage}</Badge>}
                  </div>

                  {/* Smart Suggestions */}
                  {suggestions && (
                    <div className="space-y-2 p-3 bg-violet-500/5 border border-violet-500/20 rounded">
                      <p className="text-xs font-medium text-violet-400">AI 추천 — 클릭하면 추가됩니다</p>
                      <div className="flex flex-wrap gap-1">
                        {suggestions.must_have.filter(s => !(overlay.must_have_elements || []).includes(s)).map(s => (
                          <button key={`m-${s}`} onClick={() => addSuggestion('must_have_elements', s)} className="px-2 py-0.5 text-xs rounded-full border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20">+ {s}</button>
                        ))}
                        {suggestions.forbidden.filter(s => !(overlay.forbidden_elements || []).includes(s)).map(s => (
                          <button key={`f-${s}`} onClick={() => addSuggestion('forbidden_elements', s)} className="px-2 py-0.5 text-xs rounded-full border border-red-500/30 text-red-400 hover:bg-red-500/20">+ {s}</button>
                        ))}
                        {suggestions.nice_to_have.filter(s => !(overlay.nice_to_have_elements || []).includes(s)).map(s => (
                          <button key={`n-${s}`} onClick={() => addSuggestion('nice_to_have_elements', s)} className="px-2 py-0.5 text-xs rounded-full border border-amber-500/30 text-amber-400 hover:bg-amber-500/20">+ {s}</button>
                        ))}
                        {[...suggestions.required_characters, ...suggestions.optional_characters].filter(s => !(overlay.required_character_types || []).includes(s) && !(overlay.optional_character_types || []).includes(s)).map(s => (
                          <button key={`c-${s}`} onClick={() => addSuggestion('optional_character_types', s)} className="px-2 py-0.5 text-xs rounded-full border border-sky-500/30 text-sky-400 hover:bg-sky-500/20">+ {s}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Genre Stack */}
                  <div>
                    <Label className="mb-2 block text-xs text-muted-foreground">장르 스택</Label>
                    <div className="flex flex-wrap gap-2">
                      {GENRE_TAGS.map(g => (
                        <button key={g.key} onClick={() => toggleGenre(g.key)}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${overlay.genre_stack.includes(g.key) ? 'bg-emerald-600 text-white border-emerald-600' : 'border-border text-muted-foreground hover:border-zinc-500'}`}>
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Story Central Axis */}
                  <div>
                    <Label className="mb-2 block text-xs text-muted-foreground">스토리 중심축</Label>
                    <div className="flex flex-wrap gap-2">
                      {CENTRAL_AXES.map(a => (
                        <button key={a.key} onClick={() => setOverlayTracked('story_central_axis', a.key)} title={a.desc}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${(overlay.story_central_axis ?? 'unspecified') === a.key ? 'bg-violet-600 text-white border-violet-600' : 'border-border text-muted-foreground hover:border-zinc-500'}`}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Casting */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><Label className="text-xs text-muted-foreground">주인공 수</Label><Input type="number" min={0} max={10} value={overlay.protagonist_count ?? 0} onChange={e => { trackEdit('protagonist_count'); setOverlay(p => ({ ...p, protagonist_count: parseInt(e.target.value) || 0 })); }} className="mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">주인공 구성 규칙</Label><select value={overlay.protagonist_composition ?? 'unspecified'} onChange={e => setOverlayTracked('protagonist_composition', e.target.value)} className="w-full bg-card border border-border rounded px-3 py-1.5 text-sm mt-1">{COMPOSITION_RULES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select></div>
                    <div><Label className="text-xs text-muted-foreground">총 캐릭터 제한</Label><Input type="number" min={2} max={30} value={overlay.cast_total_limit ?? 10} onChange={e => { trackEdit('cast_total_limit'); setOverlay(p => ({ ...p, cast_total_limit: parseInt(e.target.value) || 10 })); }} className="mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">연령대</Label><select value={overlay.age_group ?? 'unspecified'} onChange={e => setOverlayTracked('age_group', e.target.value)} className="w-full bg-card border border-border rounded px-3 py-1.5 text-sm mt-1">{[['unspecified', 'AI 결정'], ['high_school', '고등학생'], ['college', '대학생'], ['adult', '성인'], ['mixed', '혼합']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><Label className="text-xs text-muted-foreground">조연 최소</Label><Input type="number" min={0} max={15} value={overlay.supporting_cast_min ?? 2} onChange={e => { trackEdit('supporting_cast_min'); setOverlay(p => ({ ...p, supporting_cast_min: parseInt(e.target.value) || 0 })); }} className="mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">조연 최대</Label><Input type="number" min={0} max={15} value={overlay.supporting_cast_max ?? 5} onChange={e => { trackEdit('supporting_cast_max'); setOverlay(p => ({ ...p, supporting_cast_max: parseInt(e.target.value) || 5 })); }} className="mt-1" /></div>
                  </div>

                  {/* Tone / World / Region */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><Label className="text-xs text-muted-foreground">톤</Label><Input value={overlay.tone ?? ''} onChange={e => { trackEdit('tone'); setOverlay(p => ({ ...p, tone: e.target.value })); }} placeholder="긴장감, 감성적..." className="mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">세계관 모드</Label><Input value={overlay.world_mode ?? ''} onChange={e => { trackEdit('world_mode'); setOverlay(p => ({ ...p, world_mode: e.target.value })); }} placeholder="현실, 판타지..." className="mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">배경 지역</Label><select value={overlay.setting_region ?? 'korea'} onChange={e => setOverlayTracked('setting_region', e.target.value)} className="w-full bg-card border border-border rounded px-3 py-1.5 text-sm mt-1">{[['korea', '한국'], ['japan', '일본'], ['global', '글로벌'], ['fantasy_world', '판타지 세계'], ['custom', '직접 입력']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                    <div><Label className="text-xs text-muted-foreground">타겟 관객</Label><Input value={overlay.target_audience ?? ''} onChange={e => { trackEdit('target_audience'); setOverlay(p => ({ ...p, target_audience: e.target.value })); }} placeholder="10대~20대" className="mt-1" /></div>
                  </div>

                  {/* Series Structure */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><Label className="text-xs text-muted-foreground">에피소드 수</Label><Input type="number" min={1} max={50} value={overlay.episode_count ?? 10} onChange={e => { trackEdit('episode_count'); setOverlay(p => ({ ...p, episode_count: parseInt(e.target.value) || 10 })); }} className="mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">화당 분</Label><Input type="number" min={1} max={60} value={overlay.runtime_per_episode ?? 5} onChange={e => { trackEdit('runtime_per_episode'); setOverlay(p => ({ ...p, runtime_per_episode: parseInt(e.target.value) || 5 })); }} className="mt-1" /></div>
                  </div>

                  {/* Levels */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {([['romance_level', '로맨스'], ['mystery_level', '미스터리'], ['action_level', '액션'], ['tragedy_level', '비극']] as const).map(([key, label]) => (
                      <div key={key}><Label className="text-xs text-muted-foreground">{label}</Label><select value={overlay[key] ?? 'medium'} onChange={e => setOverlayTracked(key, e.target.value)} className="w-full bg-card border border-border rounded px-3 py-1.5 text-sm mt-1">{['none', 'low', 'medium', 'high'].map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                    ))}
                  </div>

                  {/* Events / Toggle */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div><Label className="text-xs text-muted-foreground">반전</Label><select value={overlay.twist_level ?? 'medium'} onChange={e => setOverlayTracked('twist_level', e.target.value)} className="w-full bg-card border border-border rounded px-3 py-1.5 text-sm mt-1">{['low', 'medium', 'high', 'extreme'].map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                    <div><Label className="text-xs text-muted-foreground">엔딩</Label><select value={overlay.ending_type ?? 'happy'} onChange={e => setOverlayTracked('ending_type', e.target.value)} className="w-full bg-card border border-border rounded px-3 py-1.5 text-sm mt-1">{[['happy', '해피'], ['bittersweet', '씁쓸한'], ['tragic', '비극'], ['unresolved', '열린']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                    <div><Label className="text-xs text-muted-foreground">죽음</Label><select value={overlay.death_event ?? 'none'} onChange={e => setOverlayTracked('death_event', e.target.value)} className="w-full bg-card border border-border rounded px-3 py-1.5 text-sm mt-1">{[['none', '없음'], ['optional', '선택'], ['required', '필수']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                    <div><Label className="text-xs text-muted-foreground">크리처</Label><select value={overlay.creature_usage ?? 'none'} onChange={e => setOverlayTracked('creature_usage', e.target.value)} className="w-full bg-card border border-border rounded px-3 py-1.5 text-sm mt-1">{[['none', '없음'], ['optional', '선택'], ['required', '필수']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                    <div><Label className="text-xs text-muted-foreground">능력체계</Label><select value={overlay.power_system_usage ?? 'none'} onChange={e => setOverlayTracked('power_system_usage', e.target.value)} className="w-full bg-card border border-border rounded px-3 py-1.5 text-sm mt-1">{[['none', '없음'], ['optional', '선택'], ['required', '필수']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                  </div>

                  {/* Conditional hints */}
                  {(overlay.creature_usage !== 'none' || overlay.power_system_usage !== 'none' || overlay.death_event !== 'none' || overlay.romance_level === 'high') && (
                    <div className="p-3 bg-accent/20 rounded border border-border space-y-1.5 text-xs">
                      <p className="font-medium text-muted-foreground">활성화된 조건부 규칙:</p>
                      {overlay.creature_usage !== 'none' && <p className="text-purple-400">크리처 — AI가 괴물 규칙 7항목을 생성합니다.</p>}
                      {overlay.power_system_usage !== 'none' && <p className="text-blue-400">능력체계 — 각 캐릭터의 능력/발동조건/대가가 설계됩니다.</p>}
                      {overlay.death_event !== 'none' && <p className="text-red-400">죽음/상실 — 팀 붕괴 수준의 상실 이벤트가 설계됩니다.</p>}
                      {overlay.romance_level === 'high' && <p className="text-pink-400">로맨스 High — 최소 2개 서사 기능이 연결됩니다.</p>}
                    </div>
                  )}

                  {/* Elements + Character Types */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <TagField label="필수 요소" helpText="반드시 포함" items={overlay.must_have_elements || []} onUpdate={v => setOverlay(p => ({ ...p, must_have_elements: v }))} color="emerald" placeholder="Enter로 추가..." />
                    <TagField label="금지 요소" helpText="절대 불포함" items={overlay.forbidden_elements || []} onUpdate={v => setOverlay(p => ({ ...p, forbidden_elements: v }))} color="red" placeholder="Enter로 추가..." />
                    <TagField label="있으면 좋은 요소" helpText="가능하면 반영" items={overlay.nice_to_have_elements || []} onUpdate={v => setOverlay(p => ({ ...p, nice_to_have_elements: v }))} color="amber" placeholder="Enter로 추가..." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <TagField label="필수 캐릭터 유형" helpText="반드시 포함" items={overlay.required_character_types || []} onUpdate={v => setOverlay(p => ({ ...p, required_character_types: v }))} color="emerald" placeholder="Enter로 추가..." />
                    <TagField label="선택 캐릭터 유형" helpText="있으면 좋음" items={overlay.optional_character_types || []} onUpdate={v => setOverlay(p => ({ ...p, optional_character_types: v }))} color="sky" placeholder="Enter로 추가..." />
                  </div>

                  {/* Template Save/Load */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">템플릿:</span>
                    {savedTemplates().map(t => (
                      <span key={t.name} className="inline-flex items-center gap-1">
                        <button onClick={() => loadTemplate(t)} className="px-2 py-0.5 text-xs border border-border rounded hover:bg-accent/30">{t.name}</button>
                        <button onClick={() => { deleteTemplate(t.name); setOverlay(p => ({ ...p })); }} className="text-xs text-red-400 hover:text-red-300">&times;</button>
                      </span>
                    ))}
                    {showTemplateSave ? (
                      <span className="inline-flex items-center gap-1">
                        <Input value={templateName} onChange={e => setTemplateName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveTemplate(); }} placeholder="템플릿 이름" className="h-6 text-xs w-32" />
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={saveTemplate}>저장</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowTemplateSave(false)}>취소</Button>
                      </span>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowTemplateSave(true)}>+ 현재 설정 저장</Button>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* ═══ STEP 3: 생성 버튼 ═══ */}
          <div className="flex gap-2">
            <Button onClick={() => generateConcept(projectId, { ...form, genre_overlay: overlay })} disabled={!!generating || pipelineRunning || !form.raw_input.trim()} className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-12 text-base">
              {generating === 'concept' ? 'AI 생성 중...' : concept?.approved_markdown ? '스토리 컨셉 재생성' : '스토리 컨셉 생성'}
            </Button>
            <Button
              onClick={() => runFullPipeline(projectId, { ...form, genre_overlay: overlay }, pipelineTargetScore, pipelineMaxRetries)}
              disabled={!!generating || pipelineRunning || !form.raw_input.trim()}
              className="flex-1 bg-purple-600 hover:bg-purple-700 h-12 text-base"
            >
              {pipelineRunning ? '파이프라인 실행 중...' : '원클릭 파이프라인 (AI1→AI2→AI3)'}
            </Button>
          </div>
          {/* Pipeline Settings */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>파이프라인 설정:</span>
            <label className="flex items-center gap-1">
              목표 점수
              <select
                value={pipelineTargetScore}
                onChange={e => setPipelineTargetScore(Number(e.target.value))}
                className="bg-background border border-border rounded px-1.5 py-0.5 text-xs"
              >
                <option value={3.0}>3.0 (보통)</option>
                <option value={3.5}>3.5 (괜찮음)</option>
                <option value={3.7}>3.7 (기본)</option>
                <option value={4.0}>4.0 (좋음)</option>
                <option value={4.5}>4.5 (매우 좋음)</option>
                <option value={4.75}>4.75 (최고)</option>
              </select>
              /5
            </label>
            <label className="flex items-center gap-1">
              최대 재시도
              <select
                value={pipelineMaxRetries}
                onChange={e => setPipelineMaxRetries(Number(e.target.value))}
                className="bg-background border border-border rounded px-1.5 py-0.5 text-xs"
              >
                <option value={3}>3회</option>
                <option value={5}>5회</option>
                <option value={10}>10회</option>
                <option value={20}>20회</option>
                <option value={50}>50회</option>
                <option value={100}>100회</option>
              </select>
            </label>
          </div>

          {/* ═══ RESULT ═══ */}
          {concept?.approved_markdown && (
            <Card className={`border-emerald-500/30 ${generating === 'revise' ? 'opacity-60' : ''}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-emerald-400">
                    AI 1 — 스토리 아키텍트 결과
                    {generating === 'revise' && <span className="ml-2 text-amber-400 text-sm animate-pulse">수정 재생성 중...</span>}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">v{concept.version}</Badge>
                    <Badge variant="secondary" className="text-xs">등장인물 {characters.length}명 추출됨</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {generating === 'revise' && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <p className="text-sm text-amber-400">Planner 수정 지침을 반영하여 재생성 중입니다. 완료되면 아래 내용이 새 버전으로 교체됩니다.</p>
                  </div>
                )}
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{concept.approved_markdown}</pre>

                {/* Quick Revision Buttons */}
                <div className="pt-3 border-t border-border space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">빠른 수정</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_REVISIONS.map(qr => (
                      <Button key={qr.label} variant="outline" size="sm" className="text-xs h-7" disabled={!!generating}
                        onClick={() => handleQuickRevision(qr.cmd)}>
                        {qr.label}
                      </Button>
                    ))}
                  </div>

                  {/* Custom Revision */}
                  <div className="flex gap-2">
                    <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="직접 수정 요청: 이 부분을 이렇게 바꿔줘..." rows={2} className="flex-1" />
                    <Button onClick={() => { reviseConcept(projectId, feedback); setFeedback(''); }} disabled={!!generating || !feedback.trim()} variant="outline" size="sm" className="self-end">
                      {generating === 'revise' ? '수정 중...' : '수정'}
                    </Button>
                  </div>
                </div>

                {/* Evaluation Studio */}
                <EvaluationPanel
                  projectId={projectId}
                  taskType="concept"
                  onRevise={(instructions) => { reviseConcept(projectId, instructions); }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {subTab === 'characters' && (
        <div className="space-y-6">
          {/* Auto-extract banner */}
          {concept?.approved_markdown && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div className="text-sm space-y-1">
                  {characters.length > 0 ? (
                    <>
                      <span className="text-emerald-400">스토리 컨셉에서 {characters.length}명의 등장인물이 추출되었습니다.</span>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span className="text-emerald-400">메인 {mainChars.length}</span>
                        <span className="text-blue-400">조연 {supportChars.length}</span>
                        {minorChars.length > 0 && <span className="text-zinc-400">마이너 {minorChars.length}</span>}
                      </div>
                    </>
                  ) : (
                    <span className="text-yellow-400">스토리 컨셉이 있지만 등장인물이 아직 추출되지 않았습니다.</span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => extractCharactersFromConcept(projectId)}
                  disabled={generating === 'extract_chars'}
                  className="shrink-0"
                >
                  {generating === 'extract_chars' ? 'AI 추출 중...' : characters.length > 0 ? '컨셉에서 다시 추출' : '컨셉에서 캐릭터 추출'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Main Cast */}
          {mainChars.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" /> Main Cast ({mainChars.length}명)
                <Badge variant="outline" className="text-[10px]">캐릭터 파이프라인 대상</Badge>
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {mainChars.map((c, i) => (
                  <CharacterCard key={c.id} char={c} index={i} editing={editing} expandedChar={expandedChar} setExpandedChar={setExpandedChar}
                    charForm={charForm} setCharForm={setCharForm} setEditing={setEditing}
                    handleUpdateChar={handleUpdateChar} deleteCharacter={deleteCharacter} projectId={projectId} tier="main" />
                ))}
              </div>
            </div>
          )}

          {/* Supporting Cast */}
          {supportChars.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full" /> Supporting Cast ({supportChars.length}명)
                <Badge variant="outline" className="text-[10px]">캐릭터 파이프라인 대상</Badge>
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {supportChars.map((c, i) => (
                  <CharacterCard key={c.id} char={c} index={mainChars.length + i} editing={editing} expandedChar={expandedChar} setExpandedChar={setExpandedChar}
                    charForm={charForm} setCharForm={setCharForm} setEditing={setEditing}
                    handleUpdateChar={handleUpdateChar} deleteCharacter={deleteCharacter} projectId={projectId} tier="support" />
                ))}
              </div>
            </div>
          )}

          {/* Minor Cast */}
          {minorChars.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-400 flex items-center gap-2">
                <span className="w-2 h-2 bg-zinc-500 rounded-full" /> Minor ({minorChars.length}명)
                <Badge variant="outline" className="text-[10px] text-zinc-500">캐릭터화 선택</Badge>
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {minorChars.map((c, i) => (
                  <CharacterCard key={c.id} char={c} index={mainChars.length + supportChars.length + i} editing={editing} expandedChar={expandedChar} setExpandedChar={setExpandedChar}
                    charForm={charForm} setCharForm={setCharForm} setEditing={setEditing}
                    handleUpdateChar={handleUpdateChar} deleteCharacter={deleteCharacter} projectId={projectId} tier="minor" />
                ))}
              </div>
            </div>
          )}

          {/* Add character form */}
          {characters.length < (overlay.cast_total_limit || 10) && !editing && (
            <Card className="border-dashed border-zinc-700">
              <CardHeader><CardTitle className="text-sm text-muted-foreground">수동으로 캐릭터 추가</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="col-span-2"><Label>이름 *</Label><Input value={charForm.name || ''} onChange={e => setCharForm(p => ({ ...p, name: e.target.value }))} placeholder="캐릭터 이름" className="mt-1" /></div>
                  <div><Label>역할</Label><Input value={charForm.role || ''} onChange={e => setCharForm(p => ({ ...p, role: e.target.value }))} placeholder="메인/조연/마이너" className="mt-1" /></div>
                  <div><Label>시그니처 아이템</Label><Input value={charForm.signature_item || ''} onChange={e => setCharForm(p => ({ ...p, signature_item: e.target.value }))} placeholder="수면안대, 헤드폰..." className="mt-1" /></div>
                  <div><Label>시그니처 컬러</Label><Input value={charForm.signature_color || ''} onChange={e => setCharForm(p => ({ ...p, signature_color: e.target.value }))} className="mt-1" /></div>
                  <div><Label>말투</Label><Input value={charForm.speech_style || ''} onChange={e => setCharForm(p => ({ ...p, speech_style: e.target.value }))} className="mt-1" /></div>
                  <div><Label>약점</Label><Input value={charForm.emotional_weakness || ''} onChange={e => setCharForm(p => ({ ...p, emotional_weakness: e.target.value }))} className="mt-1" /></div>
                  <div><Label>능력/특기</Label><Input value={charForm.power_or_specialty || ''} onChange={e => setCharForm(p => ({ ...p, power_or_specialty: e.target.value }))} className="mt-1" /></div>
                  <div className="col-span-2 md:col-span-4"><Label>성격/특징</Label><Textarea value={charForm.traits || ''} onChange={e => setCharForm(p => ({ ...p, traits: e.target.value }))} rows={2} className="mt-1" /></div>
                </div>
                <Button onClick={handleAddChar} className="mt-4" disabled={!charForm.name?.trim()}>추가</Button>
              </CardContent>
            </Card>
          )}

          {characters.length === 0 && !concept?.approved_markdown && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg mb-2">등장인물이 없습니다</p>
              <p className="text-sm">스토리 컨셉을 먼저 생성하면 등장인물이 자동으로 추출됩니다.</p>
            </div>
          )}

          {/* MJ Visual Prompt Generation Section */}
          {characters.length > 0 && (
            <div className="space-y-4 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-purple-400 flex items-center gap-2">
                    <span className="w-2 h-2 bg-purple-500 rounded-full" />
                    Midjourney 비주얼 프롬프트
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    캐릭터 서사를 바탕으로 AI가 MJ 이미지 프롬프트를 자동 생성합니다
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={handleGenerateAllVisuals}
                  disabled={generatingVisuals !== null}
                >
                  {generatingVisuals === 'batch' ? 'AI 생성 중...' : visualPrompts.length > 0 ? '전체 재생성' : '전체 비주얼 프롬프트 생성'}
                </Button>
              </div>

              {visualPrompts.length === 0 && generatingVisuals === null && (
                <Card className="border-dashed border-purple-500/30">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p>아직 비주얼 프롬프트가 없습니다.</p>
                    <p className="text-xs mt-1">위 버튼을 눌러 캐릭터별 Midjourney 프롬프트를 자동 생성하세요.</p>
                  </CardContent>
                </Card>
              )}

              {generatingVisuals === 'batch' && (
                <Card className="border-purple-500/30 animate-pulse">
                  <CardContent className="py-6 text-center text-purple-400">
                    모든 캐릭터의 비주얼 프롬프트를 AI가 생성 중입니다...
                  </CardContent>
                </Card>
              )}

              {visualPrompts.map(vp => {
                const isVExpanded = expandedVisual === vp.character_id;
                const char = characters.find(c => c.id === vp.character_id);
                return (
                  <Card key={vp.id} className={`border-purple-500/20 transition-all ${isVExpanded ? 'border-purple-500/50' : ''}`}>
                    <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedVisual(isVExpanded ? null : vp.character_id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge className="bg-purple-600 text-white shrink-0">{vp.character_name}</Badge>
                          {vp.style_keywords && (
                            <span className="text-xs text-muted-foreground truncate max-w-xs">{vp.style_keywords}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm" variant="ghost"
                            className="text-purple-400 text-xs"
                            onClick={e => { e.stopPropagation(); handleGenerateSingleVisual(vp.character_id); }}
                            disabled={generatingVisuals !== null}
                          >
                            {generatingVisuals === vp.character_id ? '재생성 중...' : '재생성'}
                          </Button>
                          <span className="text-xs text-muted-foreground">{isVExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      {!isVExpanded && vp.visual_brief && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{vp.visual_brief}</p>
                      )}
                    </CardHeader>
                    {isVExpanded && (
                      <CardContent className="space-y-4 pt-0">
                        {vp.visual_brief && (
                          <div className="p-3 rounded bg-purple-500/10 border border-purple-500/20">
                            <span className="text-xs font-medium text-purple-400 block mb-1">외형 요약</span>
                            <p className="text-sm">{vp.visual_brief}</p>
                          </div>
                        )}
                        <PromptBlock label="Base Portrait" prompt={vp.mj_base_prompt} color="emerald" />
                        <PromptBlock label="Emotional Portrait (3/4)" prompt={vp.mj_portrait_prompt} color="blue" />
                        <PromptBlock label="Full Body Reference" prompt={vp.mj_full_body_prompt} color="cyan" />
                        <PromptBlock label="Action / Ability Shot" prompt={vp.mj_action_prompt} color="orange" />
                        <PromptBlock label="Expression Sheet (4-Grid)" prompt={vp.mj_expression_sheet} color="pink" />
                        {vp.negative_prompts && (
                          <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                            <span className="text-xs font-medium text-red-400">Negative: </span>
                            <span className="text-xs text-muted-foreground">{vp.negative_prompts}</span>
                          </div>
                        )}
                        {char && (
                          <div className="text-xs text-muted-foreground border-t border-border pt-3 space-y-1">
                            <p>다음 단계: MJ에서 이미지 생성 → Character 탭에서 업로드 → 40-50 Shot 포즈 프롬프트 생성</p>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}

              {characters.filter(c => !visualPrompts.find(vp => vp.character_id === c.id)).length > 0 && visualPrompts.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  프롬프트 미생성 캐릭터: {characters.filter(c => !visualPrompts.find(vp => vp.character_id === c.id)).map(c => c.name).join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CharacterCard({
  char: c, index: i, editing, expandedChar, setExpandedChar,
  charForm, setCharForm, setEditing,
  handleUpdateChar, deleteCharacter, projectId, tier,
}: {
  char: StoryCharacter; index: number; editing: string | null; expandedChar: string | null;
  setExpandedChar: (id: string | null) => void;
  charForm: Partial<StoryCharacter>; setCharForm: (v: Partial<StoryCharacter>) => void;
  setEditing: (id: string | null) => void;
  handleUpdateChar: (id: string) => Promise<void>;
  deleteCharacter: (pid: string, cid: string) => Promise<void>;
  projectId: string; tier: 'main' | 'support' | 'minor';
}) {
  const isExpanded = expandedChar === c.id;
  const isEditing = editing === c.id;

  const tierColors = { main: { badge: 'bg-emerald-600 text-white', border: 'border-emerald-500/50', asset: true }, support: { badge: 'bg-blue-600 text-white', border: 'border-blue-500/50', asset: true }, minor: { badge: 'bg-zinc-600 text-white', border: 'border-zinc-500/50', asset: false } };
  const tc = tierColors[tier];

  const powerParts = c.power_or_specialty?.split(' | ') || [];
  const mainPower = powerParts[0] || '';
  const powerDetails = powerParts.slice(1);

  const traitParts = c.traits?.split(' | ') || [];
  const mainTraits = traitParts[0] || '';
  const detailTraits = traitParts.slice(1);

  if (isEditing) {
    return (
      <Card className="border-emerald-500">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">편집: {c.name}</CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => handleUpdateChar(c.id)}>저장</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setCharForm({}); }}>취소</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2"><Label>이름</Label><Input value={charForm.name || ''} onChange={e => setCharForm({ ...charForm, name: e.target.value })} className="mt-1" /></div>
            <div><Label>역할</Label><Input value={charForm.role || ''} onChange={e => setCharForm({ ...charForm, role: e.target.value })} className="mt-1" /></div>
            <div><Label>시그니처 아이템</Label><Input value={charForm.signature_item || ''} onChange={e => setCharForm({ ...charForm, signature_item: e.target.value })} className="mt-1" /></div>
            <div><Label>시그니처 컬러</Label><Input value={charForm.signature_color || ''} onChange={e => setCharForm({ ...charForm, signature_color: e.target.value })} className="mt-1" /></div>
            <div><Label>말투</Label><Input value={charForm.speech_style || ''} onChange={e => setCharForm({ ...charForm, speech_style: e.target.value })} className="mt-1" /></div>
            <div><Label>약점</Label><Input value={charForm.emotional_weakness || ''} onChange={e => setCharForm({ ...charForm, emotional_weakness: e.target.value })} className="mt-1" /></div>
            <div><Label>능력/특기</Label><Input value={charForm.power_or_specialty || ''} onChange={e => setCharForm({ ...charForm, power_or_specialty: e.target.value })} className="mt-1" /></div>
            <div className="col-span-2 md:col-span-4"><Label>성격/특징</Label><Textarea value={charForm.traits || ''} onChange={e => setCharForm({ ...charForm, traits: e.target.value })} rows={3} className="mt-1" /></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`transition-all ${isExpanded ? tc.border : 'hover:border-zinc-600'}`}>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedChar(isExpanded ? null : c.id)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Badge className={`shrink-0 ${tc.badge}`}>{i + 1}</Badge>
            <CardTitle className="text-base truncate">{c.name}</CardTitle>
            {c.role && <Badge variant="secondary" className="text-xs shrink-0 max-w-[200px] truncate">{c.role}</Badge>}
            {tc.asset && <span className="text-[10px] text-emerald-500 shrink-0" title="캐릭터 파이프라인에서 이미지 생성 가능">Asset</span>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setEditing(c.id); setCharForm({ ...c }); }}>수정</Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={e => { e.stopPropagation(); if (confirm(`${c.name} 삭제?`)) deleteCharacter(projectId, c.id); }}>삭제</Button>
            <span className="text-xs text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
          </div>
        </div>
        {!isExpanded && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {mainPower && <Badge variant="outline" className="text-xs text-cyan-400 border-cyan-500/30">{mainPower}</Badge>}
            {c.emotional_weakness && <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">{c.emotional_weakness}</Badge>}
            {c.signature_item && <Badge variant="secondary" className="text-xs">{c.signature_item}</Badge>}
          </div>
        )}
      </CardHeader>
      {isExpanded && (
        <CardContent className="text-sm space-y-3 pt-0">
          {mainTraits && <p className="text-muted-foreground">{mainTraits}</p>}

          {mainPower && (
            <div className="p-3 rounded bg-cyan-500/10 border border-cyan-500/20 space-y-1">
              <span className="text-xs font-medium text-cyan-400">능력/특기</span>
              <p className="text-sm">{mainPower}</p>
              {powerDetails.map((d, idx) => (
                <p key={idx} className="text-xs text-muted-foreground">{d}</p>
              ))}
            </div>
          )}

          {detailTraits.length > 0 && (
            <div className="space-y-1">
              {detailTraits.map((d, idx) => (
                <p key={idx} className="text-xs text-muted-foreground">{d}</p>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {c.signature_item && <Badge variant="secondary" className="text-xs">{c.signature_item}</Badge>}
            {c.signature_color && <Badge style={{ borderColor: c.signature_color.toLowerCase() }} variant="outline" className="text-xs">{c.signature_color}</Badge>}
            {c.speech_style && <Badge variant="outline" className="text-xs">{c.speech_style}</Badge>}
            {c.emotional_weakness && <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">{c.emotional_weakness}</Badge>}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
// PromptBlock — Copyable MJ prompt display
// ══════════════════════════════════════════════════════════

function PromptBlock({ label, prompt, color }: { label: string; prompt: string; color: string }) {
  const [copied, setCopied] = useState(false);
  if (!prompt) return null;

  const colorMap: Record<string, string> = {
    emerald: 'border-emerald-500/20 bg-emerald-500/5',
    blue: 'border-blue-500/20 bg-blue-500/5',
    cyan: 'border-cyan-500/20 bg-cyan-500/5',
    orange: 'border-orange-500/20 bg-orange-500/5',
    pink: 'border-pink-500/20 bg-pink-500/5',
  };
  const labelColor: Record<string, string> = {
    emerald: 'text-emerald-400', blue: 'text-blue-400', cyan: 'text-cyan-400',
    orange: 'text-orange-400', pink: 'text-pink-400',
  };

  return (
    <div className={`p-3 rounded border ${colorMap[color] || 'border-zinc-500/20 bg-zinc-500/5'} group relative`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-medium ${labelColor[color] || 'text-zinc-400'}`}>{label}</span>
        <Button
          size="sm" variant="ghost" className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => { navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground font-mono leading-relaxed break-all select-all">{prompt}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// TagField — Reusable tag-style input
// ══════════════════════════════════════════════════════════

function TagField({ label, helpText, items, onUpdate, color, placeholder }: {
  label: string; helpText: string; items: string[]; onUpdate: (v: string[]) => void;
  color: 'emerald' | 'red' | 'amber' | 'sky'; placeholder: string;
}) {
  const [inputVal, setInputVal] = useState('');
  const colorMap = {
    emerald: { bg: 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40', btn: 'hover:bg-emerald-600/30' },
    red: { bg: 'bg-red-600/20 text-red-300 border-red-600/40', btn: 'hover:bg-red-600/30' },
    amber: { bg: 'bg-amber-600/20 text-amber-300 border-amber-600/40', btn: 'hover:bg-amber-600/30' },
    sky: { bg: 'bg-sky-600/20 text-sky-300 border-sky-600/40', btn: 'hover:bg-sky-600/30' },
  };
  const c = colorMap[color];

  const addTag = () => {
    const val = inputVal.trim();
    if (val && !items.includes(val)) { onUpdate([...items, val]); setInputVal(''); }
  };

  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-[10px] text-muted-foreground/60 mb-1">{helpText}</p>
      <div className="flex flex-wrap gap-1 mb-1.5 min-h-[24px]">
        {items.map(tag => (
          <span key={tag} className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${c.bg}`}>
            {tag}
            <button onClick={() => onUpdate(items.filter(t => t !== tag))} className={`rounded-full p-0.5 ${c.btn}`}>&times;</button>
          </span>
        ))}
      </div>
      <Input
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
        onBlur={addTag}
        placeholder={placeholder}
        className="text-xs h-8"
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// TAB 2: Screenplay Director (AI 2)
// ══════════════════════════════════════════════════════════

function ScreenplayTab({ projectId }: { projectId: string }) {
  const store = useStoryStore();
  const {
    bible, episodes, currentEpisode, script,
    generating, generateBible, generateSeason, generateScript,
    fetchScript, setCurrentEpisode, concept, characters,
    evaluation, pipelineRunning, pipelineStage,
  } = store;
  const [subTab, setSubTab] = useState<'bible' | 'season' | 'script'>('bible');
  const [bibleForm, setBibleForm] = useState({
    title: '', genre: '', tone: '', world_rules: '', season_goal: '',
    core_conflict: '', ending_direction: '', audience: '', reference_mood: '',
  });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showMarkdown, setShowMarkdown] = useState(false);

  useEffect(() => {
    if (bible) {
      setBibleForm({
        title: bible.title, genre: bible.genre, tone: bible.tone,
        world_rules: bible.world_rules, season_goal: bible.season_goal,
        core_conflict: bible.core_conflict, ending_direction: bible.ending_direction,
        audience: bible.audience, reference_mood: bible.reference_mood,
      });
    } else if (concept) {
      setBibleForm(prev => ({
        ...prev,
        title: prev.title || concept.raw_input?.split('\n')[0]?.slice(0, 50) || '',
        genre: prev.genre || concept.genre || '',
        tone: prev.tone || concept.tone || '',
        audience: prev.audience || concept.target_audience || '',
        ending_direction: prev.ending_direction || concept.ending_mood || '',
      }));
    }
  }, [bible, concept]);

  useEffect(() => {
    if (subTab === 'script' && currentEpisode && episodes.length > 0) {
      fetchScript(projectId, currentEpisode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, currentEpisode, projectId]);

  let parsed: Record<string, unknown> | null = null;
  if (bible?.raw_json) { try { parsed = JSON.parse(bible.raw_json); } catch { /* empty */ } }

  let scenes: Record<string, unknown>[] = [];
  if (script?.scenes_json) { try { scenes = JSON.parse(script.scenes_json); } catch { /* empty */ } }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border pb-2">
        <Button variant={subTab === 'bible' ? 'default' : 'outline'} size="sm" onClick={() => setSubTab('bible')}>시리즈 바이블</Button>
        <Button variant={subTab === 'season' ? 'default' : 'outline'} size="sm" onClick={() => setSubTab('season')}>시즌 플래너 ({episodes.length})</Button>
        <Button variant={subTab === 'script' ? 'default' : 'outline'} size="sm" onClick={() => setSubTab('script')}>에피소드 대본</Button>
      </div>

      {/* Bible */}
      {subTab === 'bible' && (
        <div className="space-y-6">
          {concept?.approved_markdown && !bible && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="py-3 text-sm text-blue-400">AI 1의 승인된 스토리 컨셉이 있습니다. 바이블 생성 시 자동으로 반영됩니다.</CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>제목</Label><Input value={bibleForm.title} onChange={e => setBibleForm(p => ({ ...p, title: e.target.value }))} className="mt-1" /></div>
                <div><Label>장르</Label><Input value={bibleForm.genre} onChange={e => setBibleForm(p => ({ ...p, genre: e.target.value }))} className="mt-1" /></div>
                <div><Label>톤</Label><Input value={bibleForm.tone} onChange={e => setBibleForm(p => ({ ...p, tone: e.target.value }))} className="mt-1" /></div>
                <div><Label>관객</Label><Input value={bibleForm.audience} onChange={e => setBibleForm(p => ({ ...p, audience: e.target.value }))} className="mt-1" /></div>
                <div className="md:col-span-2"><Label>세계관 규칙</Label><Textarea value={bibleForm.world_rules} onChange={e => setBibleForm(p => ({ ...p, world_rules: e.target.value }))} rows={2} className="mt-1" /></div>
                <div><Label>시즌 목표</Label><Textarea value={bibleForm.season_goal} onChange={e => setBibleForm(p => ({ ...p, season_goal: e.target.value }))} rows={2} className="mt-1" /></div>
                <div><Label>핵심 갈등</Label><Textarea value={bibleForm.core_conflict} onChange={e => setBibleForm(p => ({ ...p, core_conflict: e.target.value }))} rows={2} className="mt-1" /></div>
                <div><Label>엔딩 방향</Label><Input value={bibleForm.ending_direction} onChange={e => setBibleForm(p => ({ ...p, ending_direction: e.target.value }))} className="mt-1" /></div>
                <div><Label>레퍼런스 무드</Label><Input value={bibleForm.reference_mood} onChange={e => setBibleForm(p => ({ ...p, reference_mood: e.target.value }))} className="mt-1" /></div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button onClick={() => generateBible(projectId, bibleForm)} disabled={generating === 'bible'} className="bg-emerald-600 hover:bg-emerald-700">
                  {generating === 'bible' ? '생성 중...' : bible ? '바이블 재생성' : '바이블 생성'}
                </Button>
                {characters.length === 0 && <p className="text-xs text-yellow-500 self-center">Story Architect 탭에서 컨셉을 먼저 생성하세요. 등장인물이 자동 추출됩니다.</p>}
                {characters.length > 0 && <p className="text-xs text-emerald-500 self-center">{characters.length}명의 등장인물이 AI에 전달됩니다.</p>}
              </div>
            </CardContent>
          </Card>

          {parsed && (
            <div className="space-y-4">
              <Card><CardHeader><CardTitle className="text-emerald-400">로그라인</CardTitle></CardHeader><CardContent><p className="text-lg font-medium">{String(parsed.logline || '')}</p></CardContent></Card>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['premise', 'theme', 'seasonGoal', 'coreConflict', 'seriesOverview', 'visualTone', 'episodeProgressionLogic', 'endingHook'].map(k => (
                  parsed![k] ? <Card key={k}><CardHeader><CardTitle className="text-sm">{k}</CardTitle></CardHeader><CardContent className="text-sm">{String(parsed![k])}</CardContent></Card> : null
                ))}
              </div>
              {Array.isArray(parsed.characterArcs) && (
                <Card><CardHeader><CardTitle className="text-sm">캐릭터 아크</CardTitle></CardHeader><CardContent>{(parsed.characterArcs as { name: string; arc: string }[]).map((ca, i) => (<div key={i} className="flex gap-2 text-sm mb-1"><Badge variant="outline" className="shrink-0">{ca.name}</Badge><span>{ca.arc}</span></div>))}</CardContent></Card>
              )}

              {/* Bible Evaluation */}
              <EvaluationPanel projectId={projectId} taskType="bible" />
            </div>
          )}
        </div>
      )}

      {/* Season */}
      {subTab === 'season' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">시즌 플래너</h2>
            <Button onClick={() => generateSeason(projectId)} disabled={generating === 'season' || !bible} className="bg-emerald-600 hover:bg-emerald-700">
              {generating === 'season' ? '생성 중...' : episodes.length ? '시즌 재생성' : '시즌 플랜 생성'}
            </Button>
          </div>
          {!bible && <p className="text-yellow-500 text-sm">시리즈 바이블을 먼저 생성하세요.</p>}
          <div className="space-y-3">
            {episodes.map(ep => {
              const isExp = expanded === ep.episode_number;
              return (
                <Card key={ep.id} className={isExp ? 'border-emerald-500/50' : ''}>
                  <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(isExp ? null : ep.episode_number)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3"><Badge className="bg-emerald-600 text-white">{ep.episode_number}</Badge><CardTitle className="text-base">{ep.title}</CardTitle></div>
                      <span className="text-muted-foreground text-xs">{isExp ? '접기' : '펼치기'}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{ep.purpose}</p>
                  </CardHeader>
                  {isExp && (
                    <CardContent className="text-sm space-y-3 pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-accent/30 rounded"><span className="font-medium text-emerald-400">시작:</span> {ep.beginning}</div>
                        <div className="p-3 bg-accent/30 rounded"><span className="font-medium text-yellow-400">전개:</span> {ep.middle}</div>
                        <div className="p-3 bg-accent/30 rounded"><span className="font-medium text-red-400">클라이맥스:</span> {ep.climax}</div>
                        <div className="p-3 bg-accent/30 rounded"><span className="font-medium text-blue-400">엔딩 훅:</span> {ep.ending_hook}</div>
                      </div>
                      {ep.summary && <p className="text-muted-foreground">{ep.summary}</p>}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Season Evaluation + Regeneration */}
          {episodes.length > 0 && (
            <>
              <EvaluationPanel projectId={projectId} taskType="season" />
              <div className="flex flex-wrap gap-3 mt-2">
                {store.evaluation && (
                  <Button
                    onClick={() => store.regenerateSeasonWithFeedback(projectId)}
                    disabled={store.generating === 'season' || store.pipelineRunning}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {store.generating === 'season' ? '재생성 중...' : '피드백 반영 재생성'}
                  </Button>
                )}
                <Button
                  onClick={() => store.runStagePipeline(projectId, 'season', undefined, 3.7, 5)}
                  disabled={store.pipelineRunning}
                  variant="outline"
                  className="border-amber-600 text-amber-400 hover:bg-amber-600/20"
                >
                  {store.pipelineRunning && store.pipelineStage === 'ai2_season' ? '개선 중...' : '시즌 플랜 자동 개선 (최대 5회)'}
                </Button>
              </div>
              {store.pipelineRunning && store.pipelineStage === 'ai2_season' && (
                <PipelineProgress projectId={projectId} />
              )}
            </>
          )}
        </div>
      )}

      {/* Script */}
      {subTab === 'script' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-xl font-bold">에피소드 대본</h2>
            <div className="flex items-center gap-3">
              <select value={currentEpisode} onChange={e => setCurrentEpisode(Number(e.target.value))} className="bg-card border border-border rounded px-3 py-1.5 text-sm">
                {episodes.length === 0 && <option value={1}>에피소드 없음</option>}
                {episodes.map(ep => <option key={ep.episode_number} value={ep.episode_number}>EP{ep.episode_number}: {ep.title}</option>)}
              </select>
              <Button onClick={() => generateScript(projectId, currentEpisode)} disabled={generating === 'script' || episodes.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
                {generating === 'script' ? '생성 중...' : '대본 생성'}
              </Button>
            </div>
          </div>
          {script && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button variant={showMarkdown ? 'outline' : 'default'} size="sm" onClick={() => setShowMarkdown(false)}>씬 카드</Button>
                <Button variant={showMarkdown ? 'default' : 'outline'} size="sm" onClick={() => setShowMarkdown(true)}>마크다운</Button>
              </div>
              {showMarkdown ? (
                <Card><CardContent className="pt-6"><pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">{script.markdown}</pre></CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {scenes.map((scene, i) => <SceneCard key={i} scene={scene} />)}
                </div>
              )}

              {/* Script Evaluation + Regeneration */}
              <EvaluationPanel projectId={projectId} taskType="script" episodeNumber={currentEpisode} />
              <div className="flex flex-wrap gap-3 mt-2">
                {store.evaluation && (
                  <Button
                    onClick={() => store.regenerateScriptWithFeedback(projectId, currentEpisode)}
                    disabled={store.generating === 'script' || store.pipelineRunning}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {store.generating === 'script' ? '재생성 중...' : '피드백 반영 재생성'}
                  </Button>
                )}
                <Button
                  onClick={() => store.runStagePipeline(projectId, 'script', currentEpisode, 3.7, 5)}
                  disabled={store.pipelineRunning}
                  variant="outline"
                  className="border-amber-600 text-amber-400 hover:bg-amber-600/20"
                >
                  {store.pipelineRunning && store.pipelineStage === 'ai2_scripts' ? '개선 중...' : `EP${currentEpisode} 대본 자동 개선 (최대 5회)`}
                </Button>
              </div>
              {store.pipelineRunning && store.pipelineStage === 'ai2_scripts' && (
                <PipelineProgress projectId={projectId} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SceneCard({ scene }: { scene: Record<string, unknown> }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="border-l-4 border-l-emerald-500/50">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{String(scene.sceneNumber ?? '')}</Badge>
            <CardTitle className="text-sm">{String(scene.title ?? '')}</CardTitle>
            <span className="text-xs text-muted-foreground">{String(scene.timeRange ?? '')}</span>
          </div>
          <Badge variant="secondary" className="text-xs">{String(scene.mood ?? '')}</Badge>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="text-sm space-y-2 pt-0">
          <p><span className="text-muted-foreground">장소:</span> {String(scene.location ?? '')}</p>
          <p><span className="text-muted-foreground">액션:</span> {String(scene.keyAction ?? '')}</p>
          {scene.keyDialogue ? <div className="p-2 bg-accent/30 rounded italic">&ldquo;{String(scene.keyDialogue)}&rdquo;</div> : null}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex gap-1.5">
              {Array.isArray(scene.characters) && (scene.characters as string[]).map((c, i) => <Badge key={i} variant="outline" className="text-xs">{c}</Badge>)}
            </div>
            <span>→ {String(scene.transition ?? '')}</span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
// TAB 3: Frame & Video Prompt Designer (AI 3)
// ══════════════════════════════════════════════════════════

function DesignerTab({ projectId }: { projectId: string }) {
  const store = useStoryStore();
  const { episodes, currentEpisode, setCurrentEpisode, script, clips, frames, timeline, generating, generateClipsAndFrames, fetchClipsAndFrames, fetchScript, evaluation, pipelineRunning, pipelineStage } = store;
  const [density, setDensity] = useState<'balanced' | 'cinematic_detail'>('cinematic_detail');
  const [videoProvider, setVideoProvider] = useState<VideoProvider>('higgsfield');
  const [subTab, setSubTab] = useState<'timeline' | 'frames' | 'clips'>('clips');

  useEffect(() => {
    if (currentEpisode && episodes.length > 0) {
      fetchScript(projectId, currentEpisode);
      fetchClipsAndFrames(projectId, currentEpisode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEpisode, projectId]);

  const copyText = useCallback((text: string) => { navigator.clipboard.writeText(text); }, []);

  const totalDuration = clips.reduce((sum, c) => sum + (c.duration_sec || 0), 0);

  const handleExport = (format: string) => {
    window.open(`/api/projects/${projectId}/story/export?episode=${currentEpisode}&format=${format}`, '_blank');
  };

  const activeProfile = VIDEO_PROVIDERS.find(p => p.id === videoProvider)!;

  const detectedProvider = clips.length > 0 ? (() => {
    try { const p = JSON.parse(clips[0].packet_json); return p.provider as VideoProvider || 'higgsfield'; } catch { return 'higgsfield'; }
  })() : videoProvider;

  const PHASE_COLORS: Record<string, string> = {
    cold_open: 'border-l-red-500', setup: 'border-l-blue-500', escalation: 'border-l-orange-500',
    emotional_pivot: 'border-l-pink-500', pivot: 'border-l-pink-500',
    mini_climax: 'border-l-yellow-500', climax: 'border-l-yellow-500',
    ending_hook: 'border-l-purple-500', hook: 'border-l-purple-500',
  };

  const BEAT_COLORS: Record<string, string> = {
    intro: 'bg-blue-500/20 text-blue-300', reveal: 'bg-amber-500/20 text-amber-300',
    reaction: 'bg-pink-500/20 text-pink-300', scale: 'bg-purple-500/20 text-purple-300',
    dialogue: 'bg-emerald-500/20 text-emerald-300', action: 'bg-red-500/20 text-red-300',
    transition: 'bg-zinc-500/20 text-zinc-300', custom: 'bg-cyan-500/20 text-cyan-300',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl font-bold">Frame & Video Prompt Designer</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={currentEpisode} onChange={e => setCurrentEpisode(Number(e.target.value))} className="bg-card border border-border rounded px-3 py-1.5 text-sm">
            {episodes.length === 0 && <option value={1}>에피소드 없음</option>}
            {episodes.map(ep => <option key={ep.episode_number} value={ep.episode_number}>EP{ep.episode_number}: {ep.title}</option>)}
          </select>
          <select value={videoProvider} onChange={e => setVideoProvider(e.target.value as VideoProvider)} className="bg-card border border-border rounded px-3 py-1.5 text-sm">
            {VIDEO_PROVIDERS.map(vp => <option key={vp.id} value={vp.id}>{vp.label}</option>)}
          </select>
          <select value={density} onChange={e => setDensity(e.target.value as 'balanced' | 'cinematic_detail')} className="bg-card border border-border rounded px-3 py-1.5 text-sm">
            <option value="cinematic_detail">Cinematic Detail</option>
            <option value="balanced">Balanced</option>
          </select>
          <Button onClick={() => generateClipsAndFrames(projectId, currentEpisode, density, videoProvider)} disabled={generating === 'clips' || !script} className="bg-emerald-600 hover:bg-emerald-700">
            {generating === 'clips' ? 'AI 생성 중...' : '프레임+클립 생성'}
          </Button>
        </div>
      </div>

      {/* Provider Info */}
      <div className="flex items-center gap-3 p-3 bg-accent/20 rounded text-xs">
        <Badge className={videoProvider === 'seedance_2_0' ? 'bg-violet-600 text-white' : 'bg-cyan-600 text-white'}>{activeProfile.label}</Badge>
        <span className="text-muted-foreground">{activeProfile.description}</span>
        <span className="ml-auto text-muted-foreground">클립: {activeProfile.minClipSec}~{activeProfile.maxClipSec}초</span>
        {activeProfile.supportsFrameChain && <Badge variant="outline" className="text-xs">Frame Chain</Badge>}
        {activeProfile.supportsMultiShot && <Badge variant="outline" className="text-xs">Multi-Shot</Badge>}
      </div>

      {!script && <p className="text-yellow-500 text-sm">Screenplay Director 탭에서 에피소드 대본을 먼저 생성하세요.</p>}

      {(clips.length > 0 || frames.length > 0) && (
        <>
          {/* Stats */}
          <div className="flex items-center gap-6 text-sm flex-wrap">
            {frames.length > 0 && <span>{frames.length}개 boundary frames</span>}
            <span>{clips.length}개 clips</span>
            <span>총 {totalDuration.toFixed(1)}초 ({(totalDuration / 60).toFixed(1)}분)</span>
            {detectedProvider && <Badge variant="secondary" className="text-xs">{detectedProvider}</Badge>}
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-2">
            <Button variant={subTab === 'clips' ? 'default' : 'outline'} size="sm" onClick={() => setSubTab('clips')}>
              {detectedProvider === 'seedance_2_0' ? 'Shot Sequences' : 'Clip Packets'} ({clips.length})
            </Button>
            {frames.length > 0 && <Button variant={subTab === 'frames' ? 'default' : 'outline'} size="sm" onClick={() => setSubTab('frames')}>Boundary Frames ({frames.length})</Button>}
            <Button variant={subTab === 'timeline' ? 'default' : 'outline'} size="sm" onClick={() => setSubTab('timeline')}>Timeline</Button>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('json')}>JSON</Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('txt')}>TXT</Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('md')}>MD</Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('zip')}>ZIP</Button>
            </div>
          </div>

          {/* Timeline */}
          {subTab === 'timeline' && (
            <Card>
              <CardHeader><CardTitle className="text-sm">타임라인 시나리오</CardTitle></CardHeader>
              <CardContent>
                {timeline ? (
                  <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">{timeline}</pre>
                ) : (
                  <p className="text-muted-foreground text-sm">타임라인 데이터를 생성하면 여기에 표시됩니다.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Frames (Higgsfield only) */}
          {subTab === 'frames' && (
            <div className="space-y-3">
              {frames.map(frame => (
                <Card key={frame.id} className="border-l-4 border-l-cyan-500/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-cyan-600 text-white font-mono">{frame.frame_id}</Badge>
                        <span className="text-sm font-mono text-muted-foreground">{frame.timecode}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyText(frame.image_prompt)}>복사</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2 pt-0">
                    <p className="text-muted-foreground">{frame.description}</p>
                    <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded">
                      <span className="text-xs font-medium text-cyan-400 block mb-1">Image Prompt</span>
                      <p className="text-xs leading-relaxed">{frame.image_prompt}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Clips */}
          {subTab === 'clips' && (
            <div className="space-y-3">
              {clips.map(clip => {
                let p: Record<string, unknown> = {};
                try { p = JSON.parse(clip.packet_json); } catch { /* empty */ }
                const clipProvider = String(p.provider || detectedProvider);
                const isSeedance = clipProvider === 'seedance_2_0';
                const phase = String(p.scenePhase || p.sceneObjective || 'setup').toLowerCase().replace(/\s+/g, '_');

                if (isSeedance) {
                  const shotSeq = (p.shotSequence || []) as { beatIndex: number; startSec: number; endSec: number; beatType: string; framing: string; cameraProgression: string; revealProgression: string; pacingNote: string; description: string }[];
                  return (
                    <Card key={clip.id} className={`border-l-4 ${PHASE_COLORS[phase] || 'border-l-violet-500'}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-violet-700 font-mono">{clip.clip_number}</Badge>
                            <span className="text-sm font-mono">{clip.start_time} – {clip.end_time}</span>
                            <Badge variant="outline" className="text-xs">{clip.duration_sec}s</Badge>
                            <Badge className={String(p.clipMode) === 'multi_shot' ? 'bg-amber-600 text-white text-xs' : 'bg-zinc-600 text-white text-xs'}>
                              {String(p.clipMode) === 'multi_shot' ? `multi-shot (${p.shotSequenceCount || shotSeq.length})` : 'single-beat'}
                            </Badge>
                          </div>
                          <Badge variant="secondary" className="text-xs">Seedance 2.0</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="text-sm space-y-3 pt-0">
                        {/* Scene info */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-muted-foreground">Scene:</span> {String(p.sceneObjective || '')}</div>
                          <div><span className="text-muted-foreground">Audio:</span> {String(p.audio || '')}</div>
                        </div>
                        {p.dialogue ? <div className="text-xs italic p-2 bg-accent/30 rounded">&ldquo;{String(p.dialogue)}&rdquo;</div> : null}

                        {/* Progression Summary */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {p.shotProgression ? <div><span className="text-violet-400 font-medium">Shot:</span> {String(p.shotProgression)}</div> : null}
                          {p.cameraProgression ? <div><span className="text-blue-400 font-medium">Camera:</span> {String(p.cameraProgression)}</div> : null}
                          {p.revealProgression ? <div><span className="text-amber-400 font-medium">Reveal:</span> {String(p.revealProgression)}</div> : null}
                          {p.pacingProgression ? <div><span className="text-pink-400 font-medium">Pacing:</span> {String(p.pacingProgression)}</div> : null}
                        </div>

                        {/* Shot Sequence Beats */}
                        {shotSeq.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">Shot Beats:</span>
                            <div className="flex gap-1">
                              {shotSeq.map((beat, i) => (
                                <div key={i} className="flex-1 min-w-0">
                                  <div className={`p-2 rounded text-xs ${BEAT_COLORS[beat.beatType] || BEAT_COLORS.custom}`}>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium capitalize">{beat.beatType}</span>
                                      <span className="font-mono text-[10px]">{beat.startSec}–{beat.endSec}s</span>
                                    </div>
                                    <p className="text-[10px] leading-tight opacity-80 truncate" title={beat.framing}>{beat.framing}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {/* Beat details expandable */}
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Beat 상세 보기</summary>
                              <div className="mt-2 space-y-2 pl-2 border-l border-border">
                                {shotSeq.map((beat, i) => (
                                  <div key={i} className="space-y-0.5">
                                    <div className="font-medium capitalize">{beat.beatType} ({beat.startSec}–{beat.endSec}s)</div>
                                    <div><span className="text-muted-foreground">Framing:</span> {beat.framing}</div>
                                    <div><span className="text-muted-foreground">Camera:</span> {beat.cameraProgression}</div>
                                    <div><span className="text-muted-foreground">Reveal:</span> {beat.revealProgression}</div>
                                    <div><span className="text-muted-foreground">Pacing:</span> {beat.pacingNote}</div>
                                    {beat.description && <div><span className="text-muted-foreground">Desc:</span> {beat.description}</div>}
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}

                        {/* Seedance Prompt */}
                        <div className="mt-2 p-3 bg-violet-500/10 border border-violet-500/20 rounded">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-violet-400">Seedance Prompt</span>
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyText(String(p.seedancePrompt || ''))}>복사</Button>
                          </div>
                          <p className="text-xs leading-relaxed">{String(p.seedancePrompt || '')}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }

                return (
                  <Card key={clip.id} className={`border-l-4 ${PHASE_COLORS[phase] || 'border-l-gray-500'}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-zinc-700 font-mono">{clip.clip_number}</Badge>
                          <span className="text-sm font-mono">{clip.start_time} – {clip.end_time}</span>
                          <Badge variant="outline" className="text-xs">{clip.duration_sec}s</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{String(p.shotType || '')}</Badge>
                          <Badge variant="secondary" className="text-xs">{String(p.cameraMovement || '')}</Badge>
                          {p.speedRamp && p.speedRamp !== 'auto' && p.speedRamp !== 'normal' ? <Badge variant="secondary" className="text-xs">{String(p.speedRamp)}</Badge> : null}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2 pt-0">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Start Frame:</span> {String(p.startFrameId || p.start_frame || '')}</div>
                        <div><span className="text-muted-foreground">End Frame:</span> {String(p.endFrameId || p.end_frame || '')}</div>
                        <div><span className="text-muted-foreground">Audio:</span> {String(p.audio || p.audioMode || '')}</div>
                        <div><span className="text-muted-foreground">Scene:</span> {String(p.sceneObjective || p.scenePhase || '')}</div>
                      </div>
                      {p.dialogue ? <div className="text-xs italic p-2 bg-accent/30 rounded">&ldquo;{String(p.dialogue)}&rdquo;</div> : null}

                      <div className="mt-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-emerald-400">Video Prompt</span>
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyText(String(p.videoPrompt || p.higgsfieldPrompt || ''))}>복사</Button>
                        </div>
                        <p className="text-xs leading-relaxed">{String(p.videoPrompt || p.higgsfieldPrompt || '')}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Clips Evaluation + Regeneration */}
          {clips.length > 0 && (
            <>
              <EvaluationPanel projectId={projectId} taskType="clips" episodeNumber={currentEpisode} />
              <div className="flex flex-wrap gap-3 mt-2">
                {store.evaluation && (
                  <Button
                    onClick={() => store.regenerateClipsWithFeedback(projectId, currentEpisode)}
                    disabled={store.generating === 'clips' || store.pipelineRunning}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {store.generating === 'clips' ? '재생성 중...' : '피드백 반영 재생성'}
                  </Button>
                )}
                <Button
                  onClick={() => store.runStagePipeline(projectId, 'clips', currentEpisode, 3.7, 5, 'seedance_2_0')}
                  disabled={store.pipelineRunning}
                  variant="outline"
                  className="border-amber-600 text-amber-400 hover:bg-amber-600/20"
                >
                  {store.pipelineRunning && store.pipelineStage === 'ai3_clips' ? '개선 중...' : `EP${currentEpisode} 클립 자동 개선 (최대 5회)`}
                </Button>
              </div>
              {store.pipelineRunning && store.pipelineStage === 'ai3_clips' && (
                <PipelineProgress projectId={projectId} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
