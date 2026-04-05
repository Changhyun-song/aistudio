'use client';

import { useState, useEffect, useRef } from 'react';
import { useStoryStore } from '@/lib/store/story-store';
import type { EvalTaskType, EvalResult, EvalCriterion, PlannerDecision, PlannerInit, RevisionTarget } from '@/lib/store/story-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function scoreBg(n: number): string {
  if (n >= 4.5) return 'bg-emerald-500';
  if (n >= 4) return 'bg-blue-500';
  if (n >= 3) return 'bg-yellow-500';
  if (n >= 2) return 'bg-orange-500';
  return 'bg-red-500';
}

function decisionColor(d: string) {
  switch (d) {
    case 'approve': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    case 'revise_partial': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
    case 'revise_full': return 'bg-red-500/20 text-red-400 border-red-500/40';
    case 'ask_user': return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    default: return 'bg-zinc-700 text-zinc-300';
  }
}

function decisionLabel(d: string) {
  switch (d) {
    case 'approve': return 'Approved — 다음 단계로';
    case 'revise_partial': return 'Partial Revision 필요';
    case 'revise_full': return 'Full Rewrite 필요';
    case 'ask_user': return '사용자 확인 필요';
    default: return d;
  }
}

function priorityColor(p: string) {
  switch (p) {
    case 'critical': return 'bg-red-500/20 text-red-400';
    case 'high': return 'bg-orange-500/20 text-orange-400';
    case 'medium': return 'bg-yellow-500/20 text-yellow-400';
    case 'low': return 'bg-zinc-600/20 text-zinc-400';
    default: return 'bg-zinc-700 text-zinc-300';
  }
}

interface EvaluationPanelProps {
  projectId: string;
  taskType: EvalTaskType;
  episodeNumber?: number;
  onRevise?: (instructions: string) => void;
}

export function EvaluationPanel({ projectId, taskType, episodeNumber, onRevise }: EvaluationPanelProps) {
  const store = useStoryStore();
  const { evaluation, plannerInit: pInit, plannerDecision: pDecision, evaluating, planning, evalLoop } = store;
  const [expanded, setExpanded] = useState(false);
  const [revisionApplied, setRevisionApplied] = useState(false);
  const prevGenerating = useRef(store.generating);

  useEffect(() => {
    if (prevGenerating.current === 'revise' && store.generating === null && revisionApplied) {
      setRevisionApplied(false);
    }
    prevGenerating.current = store.generating;
  }, [store.generating, revisionApplied]);

  const isRevising = store.generating === 'revise';

  const handleEvaluate = async () => {
    setRevisionApplied(false);
    await store.runEvaluation(projectId, taskType, episodeNumber);
  };

  const handlePlannerInterpret = async () => {
    await store.runPlannerInterpret(projectId, taskType);
  };

  const handleApplyRevision = () => {
    if (pDecision?.revisionTargets?.length && onRevise) {
      const instructions = pDecision.revisionTargets
        .map(t => `[${t.priority}] ${t.target}: ${t.problem}\n전략: ${t.fixStrategy}`)
        .join('\n\n');
      setRevisionApplied(true);
      onRevise(instructions);
    }
  };

  const showReEvalHint = !isRevising && revisionApplied === false && evaluation && pDecision && pDecision.decision !== 'approve';
  const hasContent = evaluation || pInit || pDecision;

  return (
    <div className="space-y-3 mt-4">
      {/* Revision In-Progress Banner */}
      {isRevising && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span className="text-sm text-amber-400 font-medium">
            Planner 수정 지침을 반영하여 재생성 중... 위 결과가 곧 업데이트됩니다.
          </span>
        </div>
      )}

      {/* Control Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-400 border-purple-500/30">
          Evaluation Studio
        </Badge>
        <Button
          size="sm" variant="outline"
          onClick={handleEvaluate}
          disabled={evaluating || !!store.generating}
          className="text-xs h-7"
        >
          {evaluating ? '평가 중...' : '평가 실행'}
        </Button>
        {evaluation && (
          <Button
            size="sm" variant="outline"
            onClick={handlePlannerInterpret}
            disabled={planning || !!store.generating}
            className="text-xs h-7"
          >
            {planning ? 'Planner 분석 중...' : 'Planner 분석'}
          </Button>
        )}
        {pDecision && pDecision.decision !== 'approve' && pDecision.revisionTargets?.length > 0 && onRevise && (
          <Button
            size="sm"
            onClick={handleApplyRevision}
            disabled={isRevising}
            className="text-xs h-7 bg-amber-600 hover:bg-amber-700"
          >
            {isRevising ? '수정 중...' : '수정 적용 → 재생성'}
          </Button>
        )}
        {hasContent && (
          <Button size="sm" variant="ghost" onClick={store.clearEvaluation} className="text-xs h-7 text-muted-foreground">
            초기화
          </Button>
        )}
        {evalLoop > 0 && <Badge variant="outline" className="text-[10px]">Loop {evalLoop}</Badge>}
      </div>

      {/* Re-evaluate hint after revision */}
      {showReEvalHint && (
        <div className="flex items-center gap-2 p-2 rounded bg-blue-500/10 border border-blue-500/20">
          <span className="text-xs text-blue-400">수정이 적용되었습니다. 결과를 다시 평가하려면:</span>
          <Button size="sm" variant="outline" className="text-xs h-6" onClick={handleEvaluate} disabled={evaluating || !!store.generating}>
            재평가
          </Button>
        </div>
      )}

      {/* Three-Panel Layout */}
      {hasContent && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <PlannerCard pInit={pInit} pDecision={pDecision} evalLoop={evalLoop} />
          <EvaluatorCard evaluation={evaluation} evaluating={evaluating} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
          <RevisionCard pDecision={pDecision} planning={planning} expanded={expanded} />
        </div>
      )}
    </div>
  );
}

/* ─── Planner Card ─── */
function PlannerCard({ pInit, pDecision, evalLoop }: { pInit: PlannerInit | null; pDecision: PlannerDecision | null; evalLoop: number }) {
  return (
    <Card className="bg-card/60 border-blue-500/20">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          Planner
          {pDecision?.stage && <Badge variant="outline" className="text-[9px] ml-auto">{pDecision.stage}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 text-xs space-y-2">
        {pInit ? (
          <>
            <div><span className="text-muted-foreground">Goal:</span> {typeof pInit.goal === 'string' ? pInit.goal : JSON.stringify(pInit.goal)}</div>
            {pInit.successContract?.length > 0 && (
              <div>
                <span className="text-muted-foreground">Success Contract:</span>
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  {pInit.successContract.map((c, i) => <li key={i}>{typeof c === 'string' ? c : JSON.stringify(c)}</li>)}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="text-muted-foreground">평가 실행 후 Planner가 활성화됩니다</div>
        )}

        {pDecision && (
          <>
            <div className={`mt-2 p-2 rounded border ${decisionColor(pDecision.decision)}`}>
              <div className="font-bold">{decisionLabel(pDecision.decision)}</div>
              <div className="mt-1 opacity-80">{typeof pDecision.replanReason === 'string' ? pDecision.replanReason : JSON.stringify(pDecision.replanReason)}</div>
            </div>
            {pDecision.nextAction && (
              <div className="text-blue-400/80 text-[10px]">Next: {typeof pDecision.nextAction === 'string' ? pDecision.nextAction : JSON.stringify(pDecision.nextAction)}</div>
            )}
          </>
        )}
        {evalLoop > 0 && <div className="text-muted-foreground">Loop: {evalLoop}</div>}
      </CardContent>
    </Card>
  );
}

/* ─── Evaluator Card ─── */
function EvaluatorCard({ evaluation, evaluating, expanded, onToggle }: {
  evaluation: EvalResult | null; evaluating: boolean; expanded: boolean; onToggle: () => void;
}) {
  return (
    <Card className="bg-card/60 border-amber-500/20">
      <CardHeader className="py-2 px-3 cursor-pointer" onClick={onToggle}>
        <CardTitle className="text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Evaluator
          {evaluation && (
            <div className="ml-auto flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded flex items-center justify-center text-white font-bold text-[10px] ${scoreBg(evaluation.weightedScore || evaluation.overallScore)}`}>
                {(evaluation.weightedScore || evaluation.overallScore || 0).toFixed(1)}
              </div>
              <Badge className={evaluation.pass ? 'bg-emerald-600 text-white text-[9px]' : 'bg-red-600 text-white text-[9px]'}>
                {evaluation.finalVerdict === 'approve' ? 'PASS' : 'REVISE'}
              </Badge>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 text-xs space-y-2">
        {evaluating && <div className="text-amber-400 animate-pulse">평가 중...</div>}
        {evaluation ? (
          <>
            {/* Strengths */}
            {evaluation.topStrengths?.length > 0 && (
              <div>
                <div className="text-emerald-400 font-medium mb-1">강점</div>
                {evaluation.topStrengths.map((s, i) => (
                  <div key={i} className="ml-2 mb-0.5"><span className="text-emerald-300">+</span> {typeof s === 'string' ? s : JSON.stringify(s)}</div>
                ))}
              </div>
            )}

            {/* Weaknesses */}
            {evaluation.topWeaknesses?.length > 0 && (
              <div>
                <div className="text-red-400 font-medium mb-1">약점</div>
                {evaluation.topWeaknesses.map((w, i) => {
                  const issue = typeof w === 'string' ? w : w?.issue || JSON.stringify(w);
                  const why = typeof w === 'object' ? w?.whyItMatters : '';
                  const fix = typeof w === 'object' ? w?.fixDirection : '';
                  return (
                    <div key={i} className="ml-2 mb-1">
                      <div><span className="text-red-300">-</span> {issue}</div>
                      {expanded && why && (
                        <>
                          <div className="text-muted-foreground ml-3 text-[10px]">{why}</div>
                          {fix && <div className="text-amber-400/70 ml-3 text-[10px]">→ {fix}</div>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Critical Issues */}
            {evaluation.criticalIssues?.length > 0 && (
              <div>
                <div className="text-red-500 font-medium mb-1">Critical Issues</div>
                {evaluation.criticalIssues.map((c, i) => (
                  <div key={i} className="ml-2 text-red-400 text-[10px]">⚠ {typeof c === 'string' ? c : JSON.stringify(c)}</div>
                ))}
              </div>
            )}

            {/* Criteria Scores */}
            {expanded && evaluation.criteria?.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-border">
                <div className="text-muted-foreground font-medium">항목별 점수</div>
                {evaluation.criteria.map((cr: EvalCriterion, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold ${scoreBg(cr.score)}`}>
                      {cr.score}
                    </div>
                    <span className={cr.mustFix ? 'text-red-400 font-medium' : 'text-muted-foreground'}>
                      {cr.name} {cr.mustFix && '⚑'}
                    </span>
                    <span className="text-muted-foreground text-[9px] ml-auto">w:{cr.weight}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Revision Brief */}
            {expanded && evaluation.revisionBrief && (
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded mt-1">
                <div className="text-amber-400 font-medium mb-1">Revision Brief</div>
                <div className="text-muted-foreground whitespace-pre-wrap">{typeof evaluation.revisionBrief === 'string' ? evaluation.revisionBrief : JSON.stringify(evaluation.revisionBrief, null, 2)}</div>
              </div>
            )}

            {!expanded && <button onClick={onToggle} className="text-[10px] text-muted-foreground hover:text-foreground">상세 보기 →</button>}
          </>
        ) : (
          <div className="text-muted-foreground">평가 버튼을 눌러 시작하세요</div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Revision Plan Card ─── */
function RevisionCard({ pDecision, planning, expanded }: {
  pDecision: PlannerDecision | null; planning: boolean; expanded: boolean;
}) {
  return (
    <Card className="bg-card/60 border-purple-500/20">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          Revision Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 text-xs space-y-2">
        {planning && <div className="text-purple-400 animate-pulse">Planner 분석 중...</div>}
        {pDecision ? (
          <>
            {pDecision.evaluationSummary && (
              <div className="font-medium">{typeof pDecision.evaluationSummary === 'string' ? pDecision.evaluationSummary : JSON.stringify(pDecision.evaluationSummary)}</div>
            )}

            {/* Revision Targets */}
            {pDecision.revisionTargets?.length > 0 && (
              <div className="space-y-2">
                {pDecision.revisionTargets.map((item: RevisionTarget, i: number) => {
                  const target = typeof item === 'string' ? item : item?.target;
                  const problem = typeof item === 'string' ? '' : item?.problem;
                  const priority = typeof item === 'string' ? 'medium' : (item?.priority || 'medium');
                  const whyItMatters = typeof item === 'string' ? '' : item?.whyItMatters;
                  const fixStrategy = typeof item === 'string' ? '' : item?.fixStrategy;
                  const expectedImpact = typeof item === 'string' ? '' : item?.expectedImpact;
                  return (
                    <div key={i} className="p-2 bg-muted/30 rounded space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Badge className={`text-[9px] ${priorityColor(priority)}`}>{priority}</Badge>
                        <span className="font-medium">{typeof target === 'string' ? target : JSON.stringify(target)}</span>
                      </div>
                      {problem && <div>{typeof problem === 'string' ? problem : JSON.stringify(problem)}</div>}
                      {expanded && (
                        <>
                          {whyItMatters && <div className="text-muted-foreground">왜 중요: {typeof whyItMatters === 'string' ? whyItMatters : JSON.stringify(whyItMatters)}</div>}
                          {fixStrategy && <div className="text-emerald-400/80">전략: {typeof fixStrategy === 'string' ? fixStrategy : JSON.stringify(fixStrategy)}</div>}
                          {expectedImpact && <div className="text-blue-400/80">예상 효과: {typeof expectedImpact === 'string' ? expectedImpact : JSON.stringify(expectedImpact)}</div>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {pDecision.nextAction && (
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded">
                <div className="text-blue-400 font-medium">Next Action</div>
                <div className="text-muted-foreground">{typeof pDecision.nextAction === 'string' ? pDecision.nextAction : JSON.stringify(pDecision.nextAction)}</div>
              </div>
            )}
          </>
        ) : (
          <div className="text-muted-foreground">Planner 분석 후 수정 계획이 표시됩니다</div>
        )}
      </CardContent>
    </Card>
  );
}
