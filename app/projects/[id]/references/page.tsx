'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useReferenceStore } from '@/lib/store/reference-store';
import type { ReferenceSource, ReferenceAnalysis, ReferenceTag } from '@/types';

const TAGS: ReferenceTag[] = ['story', 'tone', 'character', 'visual', 'monster', 'romance', 'mystery', 'pacing'];
const SOURCE_TYPES = [
  { value: 'text', label: 'Text / Memo', icon: '📝' },
  { value: 'link', label: 'Link / URL', icon: '🔗' },
  { value: 'file', label: 'File Upload', icon: '📄' },
  { value: 'image', label: 'Image', icon: '🖼️' },
  { value: 'video_note', label: 'Video Note', icon: '🎬' },
  { value: 'subtitle', label: 'Subtitle (SRT/VTT)', icon: '💬' },
] as const;

const SEND_MODES = [
  { value: 'full', label: 'Full Synthesis', desc: '모든 영감 요소를 전달' },
  { value: 'tone_visual', label: 'Tone & Visual', desc: '톤/비주얼 중심' },
  { value: 'character_relationship', label: 'Character & Relationship', desc: '캐릭터/관계 중심' },
  { value: 'mystery_twist', label: 'Mystery & Twist', desc: '미스터리/반전 중심' },
];

function parseJsonSafe(s: string | undefined | null): unknown[] {
  if (!s) return [];
  try { const r = JSON.parse(s); return Array.isArray(r) ? r : []; } catch { return []; }
}
function parseObjSafe(s: string | undefined | null): Record<string, unknown> {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return {}; }
}

export default function ReferencesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [tab, setTab] = useState<'sources' | 'analysis' | 'synthesis' | 'send'>('sources');
  const store = useReferenceStore();

  useEffect(() => {
    if (projectId && store.projectId !== projectId) {
      store.setProject(projectId);
    }
  }, [projectId]);

  useEffect(() => {
    if (store.projectId) {
      store.fetchSources();
      store.fetchSynthesis();
    }
  }, [store.projectId]);

  useEffect(() => {
    if (store.sources.length > 0) {
      for (const s of store.sources) {
        if (!store.analyses[s.id]) store.fetchSourceDetail(s.id);
      }
    }
  }, [store.sources]);

  const analyzedCount = Object.keys(store.analyses).length;
  const tabs = [
    { key: 'sources' as const, label: 'Sources', count: store.sources.length },
    { key: 'analysis' as const, label: 'Analysis', count: analyzedCount },
    { key: 'synthesis' as const, label: 'Synthesis', count: store.synthesis ? 1 : 0 },
    { key: 'send' as const, label: 'Send to Studio', count: 0 },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-zinc-400 hover:text-zinc-200 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-xl font-bold">Reference Lab</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-600/20 text-amber-400 font-medium">Inspiration Synthesizer</span>
          </div>
          <div className="flex gap-2">
            <a href={`/api/projects/${projectId}/story/references/export?format=json`} target="_blank" className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">Export JSON</a>
            <a href={`/api/projects/${projectId}/story/references/export?format=md`} target="_blank" className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">Export MD</a>
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${tab === t.key ? 'bg-zinc-800 text-white border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {t.label}
              {t.count > 0 && <span className="ml-1.5 text-xs bg-zinc-700 px-1.5 py-0.5 rounded">{t.count}</span>}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {store.error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-300 text-sm flex justify-between items-center">
            <span>{store.error}</span>
            <button onClick={() => useReferenceStore.setState({ error: null })} className="text-red-400 hover:text-red-200 ml-4 shrink-0">✕</button>
          </div>
        )}

        {tab === 'sources' && <SourcesTab />}
        {tab === 'analysis' && <AnalysisTab />}
        {tab === 'synthesis' && <SynthesisTab />}
        {tab === 'send' && <SendTab projectId={projectId} />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Sources Tab
// ═══════════════════════════════════════════════

function SourcesTab() {
  const store = useReferenceStore();
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<string>('text');
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [userNote, setUserNote] = useState('');
  const [selectedTags, setSelectedTags] = useState<ReferenceTag[]>([]);
  const [tagFilter, setTagFilter] = useState<ReferenceTag | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAdd = async () => {
    if (formType === 'file' || formType === 'image' || formType === 'subtitle') {
      const file = fileRef.current?.files?.[0];
      if (!file) return;
      await store.uploadFile(file, title, selectedTags, userNote);
    } else {
      await store.addSource({
        type: formType,
        title: title || (formType === 'link' ? sourceUrl : 'Untitled'),
        raw_text: rawText,
        source_url: sourceUrl,
        tags_json: JSON.stringify(selectedTags),
        user_note: userNote,
      });
    }
    resetForm();
  };

  const resetForm = () => {
    setTitle(''); setRawText(''); setSourceUrl(''); setUserNote('');
    setSelectedTags([]); setShowForm(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const toggleTag = (t: ReferenceTag) => setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const filteredSources = tagFilter
    ? store.sources.filter(s => { try { return JSON.parse(s.tags_json).includes(tagFilter); } catch { return false; } })
    : store.sources;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Reference Sources</h2>
        <div className="flex gap-2">
          {store.sources.length > 0 && (
            <button
              onClick={() => store.analyzeAll()}
              disabled={!!store.analyzing}
              className="text-xs px-3 py-1.5 rounded bg-purple-600/80 text-white hover:bg-purple-600 disabled:opacity-50 transition-colors"
            >
              {store.analyzing ? 'Analyzing...' : 'Analyze All'}
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)} className="text-xs px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-500 transition-colors">
            + Add Source
          </button>
        </div>
      </div>

      {/* Tag Filter */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        <button onClick={() => setTagFilter(null)} className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${!tagFilter ? 'border-amber-500 bg-amber-600/20 text-amber-300' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}>All</button>
        {TAGS.map(t => (
          <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)} className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${tagFilter === t ? 'border-amber-500 bg-amber-600/20 text-amber-300' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}>{t}</button>
        ))}
      </div>

      {showForm && (
        <div className="mb-6 p-5 bg-zinc-900 border border-zinc-700 rounded-lg space-y-4">
          <div className="flex gap-2 flex-wrap">
            {SOURCE_TYPES.map(st => (
              <button
                key={st.value}
                onClick={() => setFormType(st.value)}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${formType === st.value ? 'border-amber-500 bg-amber-600/20 text-amber-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
              >
                {st.icon} {st.label}
              </button>
            ))}
          </div>

          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:border-amber-500 focus:outline-none transition-colors" />

          {(formType === 'text' || formType === 'video_note') && (
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={formType === 'video_note' ? '영상 줄거리, 장면 요약, 또는 자막을 붙여넣으세요...' : '텍스트 내용을 입력하세요... (줄거리, 감상, 분위기 메모 등)'}
              className="w-full h-40 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm resize-y focus:border-amber-500 focus:outline-none transition-colors"
            />
          )}

          {formType === 'link' && (
            <>
              <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
              <textarea value={rawText} onChange={e => setRawText(e.target.value)} placeholder="이 링크에 대한 설명이나 줄거리를 직접 적어주세요 (URL만으론 자동 분석이 안 됩니다)" className="w-full h-24 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm resize-y focus:border-amber-500 focus:outline-none" />
            </>
          )}

          {(formType === 'file' || formType === 'image' || formType === 'subtitle') && (
            <input
              ref={fileRef}
              type="file"
              accept={formType === 'image' ? 'image/*' : formType === 'subtitle' ? '.srt,.vtt' : '.txt,.md,.pdf,.docx'}
              multiple={formType === 'image'}
              className="w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700"
            />
          )}

          <textarea
            value={userNote}
            onChange={e => setUserNote(e.target.value)}
            placeholder="이 자료에서 참고하고 싶은 부분, 좋아하는 포인트, 느낌 등을 자유롭게 적어주세요..."
            className="w-full h-20 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm resize-y focus:border-amber-500 focus:outline-none"
          />

          <div>
            <p className="text-xs text-zinc-500 mb-1.5">Tags (해당하는 것 모두 선택)</p>
            <div className="flex gap-1.5 flex-wrap">
              {TAGS.map(t => (
                <button key={t} onClick={() => toggleTag(t)} className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${selectedTags.includes(t) ? 'border-amber-500 bg-amber-600/20 text-amber-300' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}>{t}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={resetForm} className="px-4 py-2 text-xs rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">Cancel</button>
            <button onClick={handleAdd} className="px-4 py-2 text-xs rounded bg-amber-600 text-white hover:bg-amber-500 transition-colors font-medium">Add Source</button>
          </div>
        </div>
      )}

      {store.loading ? (
        <div className="text-center py-12 text-zinc-500">Loading...</div>
      ) : filteredSources.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <div className="text-4xl mb-3">📚</div>
          <p className="text-lg mb-2">No references yet</p>
          <p className="text-sm">텍스트, 링크, 파일, 이미지, 영상 메모를 추가해서<br/>영감의 재료를 쌓아보세요.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredSources.map(s => (
            <SourceCard key={s.id} source={s} analysis={store.analyses[s.id]} />
          ))}
        </div>
      )}
    </div>
  );
}

function SourceCard({ source, analysis }: { source: ReferenceSource; analysis?: ReferenceAnalysis }) {
  const store = useReferenceStore();
  const [expanded, setExpanded] = useState(false);
  const tags = parseJsonSafe(source.tags_json) as string[];

  const typeColors: Record<string, string> = {
    text: 'bg-blue-600/20 text-blue-400',
    link: 'bg-green-600/20 text-green-400',
    image: 'bg-pink-600/20 text-pink-400',
    file: 'bg-cyan-600/20 text-cyan-400',
    video_note: 'bg-orange-600/20 text-orange-400',
    subtitle: 'bg-violet-600/20 text-violet-400',
  };

  return (
    <div className={`bg-zinc-900 border rounded-lg p-4 transition-all ${expanded ? 'border-zinc-600' : 'border-zinc-800 hover:border-zinc-700'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-1.5 py-0.5 rounded ${typeColors[source.type] || 'bg-zinc-700 text-zinc-300'}`}>{source.type}</span>
            <h3 className="font-medium text-sm">{source.title}</h3>
            {analysis && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-400">Analyzed</span>}
            <span className="text-xs text-zinc-600">{expanded ? '▼' : '▶'}</span>
          </div>
          {tags.length > 0 && (
            <div className="flex gap-1 mb-1">
              {tags.map(t => <span key={t} className="text-xs px-1.5 py-0.5 rounded-full bg-amber-600/10 text-amber-400 border border-amber-600/30">{t}</span>)}
            </div>
          )}
          {source.user_note && <p className="text-xs text-zinc-500 truncate max-w-xl">{source.user_note}</p>}
        </div>
        <div className="flex gap-1.5 shrink-0 ml-3">
          <button
            onClick={() => store.analyzeSource(source.id)}
            disabled={store.analyzing === source.id}
            className="text-xs px-2.5 py-1 rounded bg-purple-600/80 text-white hover:bg-purple-600 disabled:opacity-50 transition-colors"
          >
            {store.analyzing === source.id ? '⏳' : analysis ? 'Re-analyze' : 'Analyze'}
          </button>
          <button onClick={() => store.deleteSource(source.id)} className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors">✕</button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-zinc-800 space-y-3">
          {source.raw_text && <pre className="text-xs text-zinc-400 whitespace-pre-wrap max-h-48 overflow-y-auto bg-zinc-800/50 rounded p-3">{source.raw_text.slice(0, 3000)}</pre>}
          {source.source_url && <p className="text-xs"><span className="text-zinc-500">URL:</span> <a href={source.source_url} target="_blank" rel="noopener" className="text-blue-400 hover:underline">{source.source_url}</a></p>}
          {source.file_path && source.type === 'image' && <img src={source.file_path} alt={source.title} className="max-w-sm rounded border border-zinc-700" />}
          {analysis && <AnalysisMiniView analysis={analysis} />}
        </div>
      )}
    </div>
  );
}

function AnalysisMiniView({ analysis }: { analysis: ReferenceAnalysis }) {
  const raw = parseObjSafe(analysis.raw_json);
  return (
    <div className="p-3 bg-zinc-800/60 rounded space-y-2 text-xs border border-zinc-700/50">
      <p className="font-medium text-purple-400 text-xs">Analysis Preview</p>
      {raw.highLevelSummary ? <p className="text-zinc-300">{String(raw.highLevelSummary).slice(0, 300)}</p> : null}
      <div className="flex flex-wrap gap-2">
        {analysis.genre ? <span className="px-2 py-0.5 rounded bg-blue-600/10 text-blue-400 border border-blue-600/30">Genre: {analysis.genre}</span> : null}
        {analysis.tone ? <span className="px-2 py-0.5 rounded bg-cyan-600/10 text-cyan-400 border border-cyan-600/30">Tone: {analysis.tone}</span> : null}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Analysis Tab
// ═══════════════════════════════════════════════

function AnalysisTab() {
  const store = useReferenceStore();
  const [selected, setSelected] = useState<string | null>(null);
  const analysisEntries = store.sources.filter(s => store.analyses[s.id]).map(s => ({ source: s, analysis: store.analyses[s.id] }));

  return (
    <div className="flex gap-5 min-h-[60vh]">
      <div className="w-72 shrink-0 space-y-2">
        <h2 className="text-lg font-semibold mb-3">Analyzed Sources</h2>
        {analysisEntries.length === 0 ? (
          <div className="text-zinc-500 text-sm p-4 bg-zinc-900 rounded border border-zinc-800">
            <p className="mb-2">분석된 자료가 없습니다.</p>
            <p className="text-xs">Sources 탭에서 자료를 추가하고 Analyze 버튼을 눌러주세요.</p>
          </div>
        ) : (
          analysisEntries.map(({ source }) => (
            <button
              key={source.id}
              onClick={() => setSelected(source.id)}
              className={`w-full text-left p-3 rounded border text-sm transition-colors ${selected === source.id ? 'border-amber-500 bg-amber-600/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'}`}
            >
              <div className="font-medium truncate">{source.title}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{source.type}</div>
            </button>
          ))
        )}
      </div>

      <div className="flex-1 min-w-0">
        {selected && store.analyses[selected] ? (
          <AnalysisDetail analysis={store.analyses[selected]} source={store.sources.find(s => s.id === selected)!} />
        ) : (
          <div className="flex items-center justify-center h-64 text-zinc-500 bg-zinc-900/50 rounded border border-zinc-800">
            분석된 소스를 선택하세요
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisDetail({ analysis, source }: { analysis: ReferenceAnalysis; source: ReferenceSource }) {
  const raw = parseObjSafe(analysis.raw_json);
  const store = useReferenceStore();

  const textSections = [
    { label: 'High-Level Summary', value: raw.highLevelSummary, accent: true },
    { label: 'Protagonist / Ensemble Type', value: raw.protagonistEnsembleType },
    { label: 'Pacing', value: raw.pacingNotes || analysis.pacing_notes },
    { label: 'Romance Pattern', value: raw.romancePattern || analysis.romance_pattern },
    { label: 'Twist Pattern', value: raw.twistPattern || analysis.twist_pattern },
    { label: 'Recommended Use in Original Story', value: raw.recommendedUseInOriginalStory, accent: true },
  ];

  const arraySections = [
    { label: 'Genre Signals', data: raw.genreSignals as string[] || parseJsonSafe(analysis.genre ? `["${analysis.genre}"]` : '[]'), color: 'blue' },
    { label: 'Tone Signals', data: raw.toneSignals as string[] || parseJsonSafe(analysis.tone ? `["${analysis.tone}"]` : '[]'), color: 'cyan' },
    { label: 'Themes', data: raw.themes as string[] || parseJsonSafe(analysis.themes_json), color: 'amber' },
    { label: 'Character Types', data: parseJsonSafe(analysis.character_types_json), color: 'green' },
    { label: 'Relationship Dynamics', data: parseJsonSafe(analysis.relationship_dynamics_json), color: 'pink' },
    { label: 'Mystery / Twist Devices', data: parseJsonSafe(analysis.mystery_elements_json), color: 'red' },
    { label: 'Visual Motifs', data: parseJsonSafe(analysis.visual_motifs_json), color: 'violet' },
    { label: 'Emotional Beats', data: raw.emotionalBeats as string[] || [], color: 'orange' },
    { label: 'Useful Inspiration Points', data: raw.usefulInspirationPoints as string[] || [], color: 'emerald' },
    { label: 'Avoid Copying Notes', data: raw.avoidCopyingNotes as string[] || parseJsonSafe(analysis.avoid_cliches_json), color: 'red' },
  ];

  const tagColors: Record<string, string> = {
    blue: 'bg-blue-600/10 text-blue-400 border-blue-600/30',
    cyan: 'bg-cyan-600/10 text-cyan-400 border-cyan-600/30',
    amber: 'bg-amber-600/10 text-amber-400 border-amber-600/30',
    green: 'bg-green-600/10 text-green-400 border-green-600/30',
    pink: 'bg-pink-600/10 text-pink-400 border-pink-600/30',
    red: 'bg-red-600/10 text-red-400 border-red-600/30',
    violet: 'bg-violet-600/10 text-violet-400 border-violet-600/30',
    orange: 'bg-orange-600/10 text-orange-400 border-orange-600/30',
    emerald: 'bg-emerald-600/10 text-emerald-400 border-emerald-600/30',
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold">{source.title}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{source.type} — Analysis Result</p>
        </div>
        <button onClick={() => store.analyzeSource(source.id)} disabled={store.analyzing === source.id} className="text-xs px-3 py-1.5 rounded bg-purple-600/80 text-white hover:bg-purple-600 disabled:opacity-50 transition-colors">
          {store.analyzing === source.id ? 'Analyzing...' : 'Re-analyze'}
        </button>
      </div>

      {textSections.map(s => {
        if (!s.value) return null;
        return (
          <div key={s.label}>
            <p className="text-xs text-zinc-500 font-medium mb-1">{s.label}</p>
            <p className={`text-sm whitespace-pre-wrap ${s.accent ? 'text-zinc-200' : 'text-zinc-400'}`}>{String(s.value)}</p>
          </div>
        );
      })}

      <div className="grid grid-cols-1 gap-4">
        {arraySections.map(s => {
          const items = (Array.isArray(s.data) ? s.data : []) as string[];
          if (items.length === 0) return null;
          return (
            <div key={s.label}>
              <p className="text-xs text-zinc-500 font-medium mb-1.5">{s.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((v, i) => (
                  <span key={i} className={`text-xs px-2.5 py-1 rounded border ${tagColors[s.color] || tagColors.amber}`}>{String(v)}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Synthesis Tab
// ═══════════════════════════════════════════════

function SynthesisTab() {
  const store = useReferenceStore();
  const [userGoal, setUserGoal] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const analyzedSources = store.sources.filter(s => store.analyses[s.id]);

  const toggleSource = (id: string) => setSelectedSourceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const handleGenerate = () => store.generateSynthesis(selectedSourceIds.length > 0 ? selectedSourceIds : undefined, userGoal || undefined);

  const structured = parseObjSafe(store.synthesis?.structured_json);

  const cardSections = [
    { key: 'synthesisSummary', label: 'Synthesis Summary', wide: true, accent: true },
    { key: 'recommendedOriginalAngle', label: 'Recommended Original Angle', wide: true, accent: true },
    { key: 'recommendedStoryDNA', label: 'Story DNA' },
    { key: 'recommendedVisualDNA', label: 'Visual DNA' },
    { key: 'recommendedRelationshipMap', label: 'Relationship Map' },
    { key: 'recommendedTwistDirection', label: 'Twist Direction' },
  ];

  const listCardSections = [
    { key: 'repeatedPatterns', label: 'Repeated Patterns', color: 'text-zinc-300' },
    { key: 'strongestToneDirections', label: 'Strongest Tone', color: 'text-cyan-400' },
    { key: 'strongestCharacterRelationshipPatterns', label: 'Character Relationships', color: 'text-pink-400' },
    { key: 'strongestConflictStructures', label: 'Conflict Structures', color: 'text-red-400' },
    { key: 'strongestMysteryTwistIdeas', label: 'Mystery / Twist Ideas', color: 'text-orange-400' },
    { key: 'strongestVisualMotifs', label: 'Visual Motifs', color: 'text-violet-400' },
    { key: 'romanceIntegrationIdeas', label: 'Romance Integration', color: 'text-pink-300' },
    { key: 'schoolLifeIntegrationIdeas', label: 'School-Life Integration', color: 'text-blue-400' },
    { key: 'creatureSFInspirationIdeas', label: 'Creature / SF Inspiration', color: 'text-green-400' },
    { key: 'originalityWarningPoints', label: 'Originality Warnings', color: 'text-yellow-400' },
  ];

  const triSections = [
    { key: 'whatToKeep', label: 'What to Keep', color: 'text-green-400', border: 'border-green-800/30' },
    { key: 'whatToRemix', label: 'What to Remix', color: 'text-amber-400', border: 'border-amber-800/30' },
    { key: 'whatToAvoid', label: 'What to Avoid', color: 'text-red-400', border: 'border-red-800/30' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Inspiration Synthesis</h2>
        <button
          onClick={handleGenerate}
          disabled={store.synthesizing || analyzedSources.length === 0}
          className="px-4 py-2 text-sm rounded bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 transition-colors font-medium"
        >
          {store.synthesizing ? 'Synthesizing...' : store.synthesis ? 'Regenerate' : 'Generate Synthesis'}
        </button>
      </div>

      <div className="mb-5 p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-3">
        <p className="text-xs text-zinc-500">소스 선택 (미선택 시 분석된 소스 전체 사용):</p>
        <div className="flex flex-wrap gap-2">
          {analyzedSources.map(s => (
            <button key={s.id} onClick={() => toggleSource(s.id)} className={`px-3 py-1.5 text-xs rounded border transition-colors ${selectedSourceIds.includes(s.id) ? 'border-amber-500 bg-amber-600/20 text-amber-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>{s.title}</button>
          ))}
        </div>
        <textarea
          value={userGoal}
          onChange={e => setUserGoal(e.target.value)}
          placeholder="창작 목표 (선택): 예) '한국 고등학교 배경 히어로물', '청춘 SF 괴물물', '로맨스+미스터리 혼합'"
          className="w-full h-20 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm resize-y focus:border-amber-500 focus:outline-none"
        />
      </div>

      {store.synthesis ? (
        <div className="space-y-5">
          {/* Text card sections */}
          <div className="grid grid-cols-2 gap-3">
            {cardSections.map(s => {
              const val = structured[s.key];
              if (!val) return null;
              return (
                <div key={s.key} className={`p-4 bg-zinc-900 border border-zinc-800 rounded-lg ${s.wide ? 'col-span-2' : ''}`}>
                  <p className={`text-xs font-bold mb-1.5 ${s.accent ? 'text-amber-400' : 'text-zinc-400'}`}>{s.label}</p>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{String(val)}</p>
                </div>
              );
            })}
          </div>

          {/* Keep / Remix / Avoid tri-section */}
          <div className="grid grid-cols-3 gap-3">
            {triSections.map(s => {
              const val = structured[s.key];
              if (!val || !Array.isArray(val)) return null;
              return (
                <div key={s.key} className={`p-4 bg-zinc-900 border rounded-lg ${s.border}`}>
                  <p className={`text-xs font-bold mb-2 ${s.color}`}>{s.label}</p>
                  <ul className="space-y-1.5">
                    {(val as string[]).map((item, i) => <li key={i} className="text-xs text-zinc-300">• {item}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* List card sections */}
          <div className="grid grid-cols-2 gap-3">
            {listCardSections.map(s => {
              const val = structured[s.key];
              if (!val || !Array.isArray(val) || (val as string[]).length === 0) return null;
              return (
                <div key={s.key} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                  <p className={`text-xs font-bold mb-2 ${s.color}`}>{s.label}</p>
                  <ul className="space-y-1">
                    {(val as string[]).map((item, i) => <li key={i} className="text-xs text-zinc-400">• {item}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-zinc-500">
          <div className="text-4xl mb-3">🔬</div>
          {analyzedSources.length === 0
            ? <p>먼저 Sources 탭에서 자료를 분석해주세요.</p>
            : <p>&quot;Generate Synthesis&quot;를 클릭해 모든 분석을 종합하세요.</p>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Send to Studio Tab
// ═══════════════════════════════════════════════

function SendTab({ projectId }: { projectId: string }) {
  const store = useReferenceStore();
  const router = useRouter();
  const [mode, setMode] = useState('full');
  const [userConcept, setUserConcept] = useState('');
  const [building, setBuilding] = useState(false);
  const [storyInput, setStoryInput] = useState<Record<string, unknown> | null>(null);
  const [sentResult, setSentResult] = useState<string | null>(null);

  const handleBuild = async () => {
    setBuilding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/story/references/send-to-studio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'build', user_concept: userConcept }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStoryInput(data.storyInput);
    } catch (err: unknown) {
      useReferenceStore.setState({ error: err instanceof Error ? err.message : 'Build failed' });
    } finally {
      setBuilding(false);
    }
  };

  const handleSend = async () => {
    try {
      const { inspirationText } = await store.sendToStudio(mode);
      setSentResult(inspirationText);
    } catch { /* error in store */ }
  };

  const storyInputSections = [
    { key: 'storyConceptSeed', label: 'Story Concept Seed' },
    { key: 'genreRecommendation', label: 'Genre' },
    { key: 'toneRecommendation', label: 'Tone' },
    { key: 'worldbuildingDirection', label: 'Worldbuilding' },
    { key: 'protagonistTeamDirection', label: 'Protagonist / Team' },
    { key: 'conflictRecommendation', label: 'Conflict' },
    { key: 'romanceRecommendation', label: 'Romance' },
    { key: 'mysteryRecommendation', label: 'Mystery' },
    { key: 'visualSymbolsRecommendation', label: 'Visual Symbols' },
    { key: 'promptReadySummary', label: 'Prompt-Ready Summary' },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Send to Story Studio</h2>

      {!store.synthesis ? (
        <div className="text-center py-16 text-zinc-500">
          <div className="text-4xl mb-3">🚀</div>
          <p className="mb-2">Synthesis가 아직 없습니다.</p>
          <p className="text-sm">Synthesis 탭에서 먼저 종합 결과를 생성해주세요.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Step 1: Build Story Input */}
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-lg">
            <h3 className="text-sm font-bold text-amber-400 mb-3">Step 1: Story Input 생성</h3>
            <p className="text-xs text-zinc-500 mb-3">
              Synthesis 결과를 Story Architect가 바로 사용할 수 있는 형식으로 변환합니다.
            </p>
            <textarea
              value={userConcept}
              onChange={e => setUserConcept(e.target.value)}
              placeholder="추가 컨셉이 있다면 적어주세요 (선택)..."
              className="w-full h-16 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm resize-y focus:border-amber-500 focus:outline-none mb-3"
            />
            <button onClick={handleBuild} disabled={building} className="px-4 py-2 text-sm rounded bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 transition-colors font-medium">
              {building ? 'Building...' : storyInput ? 'Rebuild Story Input' : 'Build Story Input'}
            </button>
          </div>

          {/* Story Input Preview */}
          {storyInput && (
            <div className="p-5 bg-zinc-900 border border-purple-800/30 rounded-lg">
              <h3 className="text-sm font-bold text-purple-400 mb-3">Story Input Preview</h3>
              <div className="grid grid-cols-2 gap-3">
                {storyInputSections.map(s => {
                  const val = storyInput[s.key];
                  if (!val) return null;
                  return (
                    <div key={s.key} className={`p-3 bg-zinc-800 rounded ${s.key === 'promptReadySummary' || s.key === 'storyConceptSeed' ? 'col-span-2' : ''}`}>
                      <p className="text-xs text-zinc-500 font-medium mb-1">{s.label}</p>
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">{String(val)}</p>
                    </div>
                  );
                })}
                {Array.isArray(storyInput.clicheAvoidList) && (storyInput.clicheAvoidList as string[]).length > 0 && (
                  <div className="col-span-2 p-3 bg-zinc-800 rounded">
                    <p className="text-xs text-red-400 font-medium mb-1">Cliché Avoid List</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(storyInput.clicheAvoidList as string[]).map((c, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded bg-red-600/10 text-red-400 border border-red-600/30">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Send */}
          <div className="p-5 bg-zinc-900 border border-amber-600/30 rounded-lg">
            <h3 className="text-sm font-bold text-amber-400 mb-3">Step 2: Story Studio로 전달</h3>
            <p className="text-xs text-zinc-500 mb-3">
              선택한 영감 데이터를 Story Architect의 concept 입력에 추가합니다.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {SEND_MODES.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={`px-4 py-2 text-sm rounded border transition-colors ${mode === m.value ? 'border-amber-500 bg-amber-600/20 text-amber-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                >
                  <div>{m.label}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
            <button
              onClick={handleSend}
              disabled={store.sending}
              className="px-6 py-2.5 text-sm rounded bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 transition-colors font-medium"
            >
              {store.sending ? 'Sending...' : 'Use in Story Architect'}
            </button>
          </div>

          {sentResult && (
            <div className="p-5 bg-zinc-900 border border-green-800/30 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-green-400">전달 완료</h3>
                <button onClick={() => router.push(`/projects/${projectId}/story-studio`)} className="text-xs px-4 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 transition-colors font-medium">
                  Go to Story Studio →
                </button>
              </div>
              <pre className="text-xs text-zinc-400 whitespace-pre-wrap max-h-60 overflow-y-auto bg-zinc-800/50 rounded p-3">{sentResult}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
