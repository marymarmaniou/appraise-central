import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Evaluation, ApplicantField, TriageDecision } from "@/lib/types";
import { ArrowLeft, ArrowRight, ChevronLeft, FileText, Check } from "lucide-react";

const EvaluationView = () => {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const { user, programs, getJudgeEvaluation, saveEvaluation } = useApp();
  const program = programs.find(p => p.id === programId);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [saved, setSaved] = useState(false);

  const applicants = program?.applicants || [];
  const applicant = applicants[currentIdx];

  // Get existing evaluation
  const existing = useMemo(() => {
    if (!program || !applicant || !user) return undefined;
    return getJudgeEvaluation(program.id, applicant.id, user.name);
  }, [program, applicant, user, getJudgeEvaluation]);

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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/judge`)} className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="font-display text-lg leading-tight">{applicant.name}</h2>
              <p className="text-[10px] text-muted-foreground font-body">Submitted {new Date(applicant.submittedAt).toLocaleDateString()}</p>
            </div>
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
          {applicant.fields.map((f, i) => (
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
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDecision(opt.value)}
                  className={`w-full h-12 rounded-lg border-2 text-sm font-body font-medium transition-all flex items-center justify-center gap-2 ${
                    decision === opt.value ? opt.activeBg + " border-transparent" : opt.color + " hover:bg-accent/50"
                  }`}
                >
                  {decision === opt.value && <Check className="w-4 h-4" />}
                  {opt.value === "yes" ? "✓" : opt.value === "no" ? "✗" : "◎"} {opt.label}
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
        </div>

        <div className="space-y-2 mt-auto">
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
          <a href={field.value} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-body">
            <FileText className="w-4 h-4 text-primary" /> Open PDF ↗
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
