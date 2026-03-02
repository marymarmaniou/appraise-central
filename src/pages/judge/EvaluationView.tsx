import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Evaluation, ApplicantField, TriageDecision } from "@/lib/types";
import { ArrowLeft, ArrowRight, ChevronLeft, FileText, Check } from "lucide-react";

const EvaluationView = () => {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  // Added getEvaluationsForApplicant here
  const { user, programs, getJudgeEvaluation, saveEvaluation, getEvaluationsForApplicant } = useApp();
  const program = programs.find(p => p.id === programId);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [saved, setSaved] = useState(false);

  const applicants = program?.applicants || [];
  const applicant = applicants[currentIdx];

  // Get existing evaluation for the current judge
  const existing = useMemo(() => {
    if (!program || !applicant || !user) return undefined;
    return getJudgeEvaluation(program.id, applicant.id, user.name);
  }, [program, applicant, user, getJudgeEvaluation]);

  // Get evaluations from OTHER judges (only if user is internal)
  const otherEvaluations = useMemo(() => {
    if (!program || !applicant || !user?.isInternal) return [];
    return getEvaluationsForApplicant(program.id, applicant.id).filter(e => e.judgeName !== user.name);
  }, [program, applicant, user, getEvaluationsForApplicant]);

  // Scoring state
  const [scores, setScores] = useState<Record<string, number>>({});
  const [decision, setDecision] = useState<TriageDecision | undefined>();
  const [notes, setNotes] = useState("");

  // Reset when applicant changes
  useEffect(() => {
    if (existing) {
      setScores(existing.scores || {});
      setDecision(existing.decision);
      setNotes(existing.notes);
    } else {
      const initial: Record<string, number> = {};
      program?.criteria.forEach(c => { initial[c.id] = 0; });
      setScores(initial);
      setDecision(undefined);
      setNotes("");
    }
    setSaved(false);
  }, [currentIdx, existing, program]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft" && currentIdx > 0) setCurrentIdx(i => i - 1);
      if (e.key === "ArrowRight" && currentIdx < applicants.length - 1) setCurrentIdx(i => i + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentIdx, applicants.length]);

  const totalScore = useMemo(() => {
    return Object.values(scores).reduce((a, b) => a + b, 0);
  }, [scores]);

  const maxTotal = useMemo(() => {
    return program?.criteria.reduce((s, c) => s + c.maxScore, 0) || 0;
  }, [program]);

  const handleSave = useCallback((advance: boolean) => {
    if (!program || !applicant || !user) return;
    const evaluation: Evaluation = {
      programId: program.id,
      applicantId: applicant.id,
      judgeName: user.name,
      mode: program.mode,
      ...(program.mode === "scoring" ? { scores, totalScore } : { decision }),
      notes,
      submittedAt: new Date().toISOString(),
    };
    saveEvaluation(evaluation);
    setSaved(true);

    if (advance) {
      setTimeout(() => {
        // Find next unscored
        const nextUnscored = applicants.findIndex((a, i) => i > currentIdx && !getJudgeEvaluation(program.id, a.id, user.name));
        if (nextUnscored >= 0) setCurrentIdx(nextUnscored);
        else if (currentIdx < applicants.length - 1) setCurrentIdx(i => i + 1);
      }, 400);
    }
  }, [program, applicant, user, scores, totalScore, decision, notes, saveEvaluation, currentIdx, applicants, getJudgeEvaluation]);

  if (!program) return <div className="p-8 text-muted-foreground font-body">Program not found.</div>;
  if (!applicant) return <div className="p-8 text-muted-foreground font-body">No applicants in this program.</div>;

  const scorePct = maxTotal > 0 ? (totalScore / maxTotal) * 100 : 0;
  const scoreColor = scorePct > 70 ? "bg-success" : scorePct > 40 ? "bg-warning" : "bg-destructive";

  return (
    <div className="h-[calc(100vh-56px)] flex animate-fade-in">
      {/* LEFT PANEL */}
      <div className="flex-[3] overflow-y-auto border-r border-border">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(`/judge`)} className="text-muted-foreground hover:text-foreground transition-colors mr-1">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select 
                className="font-display text-lg leading-tight bg-transparent border-none focus:ring-0 cursor-pointer outline-none appearance-none hover:bg-accent/50 rounded px-1"
                value={currentIdx}
                onChange={(e) => setCurrentIdx(Number(e.target.value))}
              >
                {applicants.map((app, idx) => (
                  <option key={app.id} value={idx}>
                    {idx + 1}. {app.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[10px] text-muted-foreground font-body ml-8">
              Submitted {new Date(applicant.submittedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentIdx(i => i - 1)}
              disabled={currentIdx === 0}
              className="h-8 w-8 flex items-center justify-center border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-30"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-muted-foreground font-body min-w-[40px] text-center">
              {currentIdx + 1} / {applicants.length}
            </span>
            <button
              onClick={() => setCurrentIdx(i => i + 1)}
              disabled={currentIdx === applicants.length - 1}
              className="h-8 w-8 flex items-center justify-center border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-30"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {applicant.fields
            .filter(f => f.value.toLowerCase() !== "false" && f.value !== "")
            .map((f, i) => (
              <FieldRenderer key={i} field={f} />
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-[2] max-w-md p-6 overflow-y-auto flex flex-col">
        <div className="mb-4">
          <p className="text-xs text-muted-foreground font-body">{program.title}</p>
          <p className="text-xs text-muted-foreground font-body mt-0.5">{currentIdx + 1} of {applicants.length}</p>
        </div>

        <div className="flex-1">
          {program.mode === "triage" ? (
            <div className="space-y-2 mb-6">
              {([
                { value: "yes" as const, label: "Yes", color: "border-success text-success", activeBg: "bg-success text-success-foreground" },
                { value: "no" as const, label: "No", color: "border-destructive text-destructive", activeBg: "bg-destructive text-destructive-foreground" },
                { value: "review" as const, label: "Needs Review", color: "border-warning text-warning", activeBg: "bg-warning text-warning-foreground" },
                { value: "disqualify" as const, label: "Disqualify", color: "border-red-900 text-red-900", activeBg: "bg-red-900 text-white" },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDecision(opt.value)}
                  className={`w-full h-12 rounded-lg border-2 text-sm font-body font-medium transition-all flex items-center justify-center gap-2 ${
                    decision === opt.value ? opt.activeBg + " border-transparent" : opt.color + " hover:bg-accent/50"
                  }`}
                >
                  {decision === opt.value && <Check className="w-4 h-4" />}
                  {opt.value === "yes" ? "✓" : opt.value === "no" ? "✗" : opt.value === "disqualify" ? "∅" : "◎"} {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {program.criteria.map(criterion => {
                const score = scores[criterion.id] || 0;
                const pct = criterion.maxScore > 0 ? (score / criterion.maxScore) * 100 : 0;
                return (
                  <div key={criterion.id}>
                    <div className="flex items-baseline justify-between mb-1">
                      <label className="text-sm font-body font-medium">{criterion.label}</label>
                      <span className="text-xs font-body font-bold">{score}/{criterion.maxScore}</span>
                    </div>
                    {criterion.hint && <p className="text-[10px] text-muted-foreground font-body mb-2">{criterion.hint}</p>}
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={criterion.maxScore}
                        value={score}
                        onChange={e => setScores(prev => ({ ...prev, [criterion.id]: parseInt(e.target.value) }))}
                        className="flex-1 h-1.5 bg-accent rounded-sm appearance-none cursor-pointer"
                      />
                      <input
                        type="number"
                        min={0}
                        max={criterion.maxScore}
                        value={score}
                        onChange={e => {
                          const v = Math.min(criterion.maxScore, Math.max(0, parseInt(e.target.value) || 0));
                          setScores(prev => ({ ...prev, [criterion.id]: v }));
                        }}
                        className="w-12 h-8 text-center border border-border rounded-lg text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                );
              })}

              {/* Total score bar */}
              <div className="pt-2 border-t border-border">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-sm font-body font-medium">Total</span>
                  <span className="text-lg font-display">{totalScore} <span className="text-sm text-muted-foreground">/ {maxTotal}</span></span>
                </div>
                <div className="w-full h-2 bg-accent rounded-sm overflow-hidden">
                  <div className={`h-full rounded-sm transition-all duration-300 ${scoreColor}`} style={{ width: `${scorePct}%` }} />
                </div>
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs text-muted-foreground font-body mb-1">Internal notes (not shared with applicant)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              rows={3}
              placeholder="Your notes..."
            />
          </div>

          {/* Internal Judges View */}
          {user?.isInternal && otherEvaluations.length > 0 && (
            <div className="mt-6 mb-4 border-t border-border pt-4">
              <h4 className="text-sm font-display mb-3">Other Judges' Evaluations</h4>
              <div className="space-y-3">
                {otherEvaluations.map((ev, i) => (
                  <div key={i} className="p-3 bg-accent/30 rounded-lg border border-border/50">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold">{ev.judgeName}</p>
                      {ev.mode === "scoring" ? (
                        <p className="text-xs font-bold text-primary">{ev.totalScore} pts</p>
                      ) : (
                        <p className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          ev.decision === 'yes' ? 'bg-success/20 text-success' : 
                          ev.decision === 'no' ? 'bg-destructive/20 text-destructive' : 
                          ev.decision === 'disqualify' ? 'bg-red-900/20 text-red-900' : 
                          'bg-warning/20 text-warning'
                        }`}>
                          {ev.decision}
                        </p>
                      )}
                    </div>
                    {ev.notes && <p className="text-xs text-muted-foreground italic mt-2">"{ev.notes}"</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2 mt-auto pt-4">
          {existing && (
            <p className="text-[10px] text-muted-foreground font-body text-center">
              Last saved {new Date(existing.submittedAt).toLocaleString()}
            </p>
          )}
          <button
            onClick={() => handleSave(true)}
            className={`w-full h-10 rounded-lg text-sm font-body font-medium transition-all ${
              saved ? "bg-success text-success-foreground animate-success-pulse" : "bg-foreground text-background hover:bg-foreground/90"
            }`}
          >
            {saved ? "✓ Saved" : "Save & Next →"}
          </button>
          <button
            onClick={() => handleSave(false)}
            className="w-full h-9 rounded-lg border border-border text-sm font-body hover:bg-accent transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

function FieldRenderer({ field }: { field: ApplicantField }) {
  if (field.type === "file" || field.fileType) {
    const ft = field.fileType;
    if (ft === "image") {
      return (
        <div>
          <p className="text-xs text-muted-foreground font-body mb-1">{field.label}</p>
          <img src={field.value} alt={field.label} className="w-full rounded-lg border border-border" loading="lazy" />
        </div>
      );
    }
    if (ft === "youtube" || ft === "vimeo") {
      const embedUrl = ft === "youtube"
        ? field.value.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")
        : field.value;
      return (
        <div>
          <p className="text-xs text-muted-foreground font-body mb-1">{field.label}</p>
          <iframe src={embedUrl} className="w-full aspect-video rounded-lg border border-border" allowFullScreen />
        </div>
      );
    }
    if (ft === "video") {
      return (
        <div>
          <p className="text-xs text-muted-foreground font-body mb-1">{field.label}</p>
          <video src={field.value} controls className="w-full rounded-lg border border-border" />
        </div>
      );
    }
    if (ft === "pdf") {
      return (
        <div>
          <p className="text-xs text-muted-foreground font-body mb-1">{field.label}</p>
          <iframe src={field.value} className="w-full h-96 rounded-lg border border-border bg-card" title={field.label} />
          <a href={field.value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 p-2 border border-border rounded-lg hover:bg-accent transition-colors text-xs font-body text-primary">
            <FileText className="w-3 h-3" /> Open PDF in new tab ↗
          </a>
        </div>
      );
    }
    if (ft === "excel") {
      const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(field.value)}`;
      return (
        <div>
          <p className="text-xs text-muted-foreground font-body mb-1">{field.label}</p>
          <iframe src={viewerUrl} className="w-full h-96 rounded-lg border border-border bg-card" title={field.label} />
          <a href={field.value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 p-2 border border-border rounded-lg hover:bg-accent transition-colors text-xs font-body text-primary">
            <FileText className="w-3 h-3" /> Download Excel Document ↗
          </a>
        </div>
      );
    }
    return (
      <div>
        <p className="text-xs text-muted-foreground font-body mb-1">{field.label}</p>
        <a href={field.value} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-body">
          <FileText className="w-4 h-4 text-muted-foreground" /> Open ↗
        </a>
      </div>
    );
  }

  const isTagLike = field.value.includes(",") && field.value.split(",").every(s => s.trim().length < 30);

  return (
    <div>
      <p className="text-xs text-muted-foreground font-body mb-1">{field.label}</p>
      {isTagLike ? (
        <div className="flex flex-wrap gap-1">
          {field.value.split(",").map((t, i) => (
            <span key={i} className="text-xs font-body px-2 py-0.5 bg-accent rounded">{t.trim()}</span>
          ))}
        </div>
      ) : field.value.length > 100 ? (
        <p className="text-sm font-body leading-relaxed">{field.value}</p>
      ) : (
        <p className="text-sm font-body font-medium">{field.value}</p>
      )}
    </div>
  );
}

export default EvaluationView;
