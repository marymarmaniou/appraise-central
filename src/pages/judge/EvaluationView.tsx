import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Evaluation, ApplicantField, TriageDecision } from "@/lib/types";
import { ArrowLeft, ArrowRight, ChevronLeft, FileText, Check, Download } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import jsPDF from "jspdf";

const EvaluationView = () => {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const { user, programs, getJudgeEvaluation, saveEvaluation, getEvaluationsForApplicant } = useApp();
  const program = programs.find(p => p.id === programId);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const isMobile = useIsMobile();

  const applicants = program?.applicants || [];
  const applicant = applicants[currentIdx];

  const existing = useMemo(() => {
    if (!program || !applicant || !user) return undefined;
    return getJudgeEvaluation(program.id, applicant.id, user.name);
  }, [program, applicant, user, getJudgeEvaluation]);

  // Only internal judges see other evaluations
  const otherEvaluations = useMemo(() => {
    if (!program || !applicant || !user?.isInternal) return [];
    return getEvaluationsForApplicant(program.id, applicant.id).filter(e => e.judgeName !== user.name);
  }, [program, applicant, user, getEvaluationsForApplicant]);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [decision, setDecision] = useState<TriageDecision | undefined>();
  const [notes, setNotes] = useState("");

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft" && currentIdx > 0) setCurrentIdx(i => i - 1);
      if (e.key === "ArrowRight" && currentIdx < applicants.length - 1) setCurrentIdx(i => i + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentIdx, applicants.length]);

  const totalScore = useMemo(() => Object.values(scores).reduce((a, b) => a + b, 0), [scores]);
  const maxTotal = useMemo(() => program?.criteria.reduce((s, c) => s + c.maxScore, 0) || 0, [program]);

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
        const nextUnscored = applicants.findIndex((a, i) => i > currentIdx && !getJudgeEvaluation(program.id, a.id, user.name));
        if (nextUnscored >= 0) setCurrentIdx(nextUnscored);
        else if (currentIdx < applicants.length - 1) setCurrentIdx(i => i + 1);
      }, 400);
    }
  }, [program, applicant, user, scores, totalScore, decision, notes, saveEvaluation, currentIdx, applicants, getJudgeEvaluation]);

  const handleExportPDF = useCallback(() => {
    if (!program || !applicant) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    const addText = (text: string, x: number, fontSize: number, style: string = "normal", color: [number, number, number] = [0, 0, 0]) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", style);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, pageWidth - x - 15);
      if (y + lines.length * (fontSize * 0.5) > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, x, y);
      y += lines.length * (fontSize * 0.5) + 2;
    };

    // Header
    addText(program.title, 15, 18, "bold", [134, 160, 105]);
    addText(`Applicant: ${applicant.name}`, 15, 14, "bold");
    addText(`Submitted: ${new Date(applicant.submittedAt).toLocaleDateString()}`, 15, 10, "normal", [120, 120, 120]);
    y += 5;

    // Fields
    applicant.fields.forEach((f: ApplicantField) => {
      if (f.value.toLowerCase() === "false" || f.value === "") return;
      addText(f.label, 15, 10, "bold", [100, 100, 100]);
      if (f.type === "boolean") {
        addText(f.booleanValue ? "Yes" : "No", 15, 11);
      } else if (f.type === "multiselect" && f.selectedOptions) {
        addText(f.selectedOptions.join(", "), 15, 11);
      } else if (f.type === "file" || f.fileType) {
        doc.setTextColor(134, 160, 105);
        doc.textWithLink(f.value.length > 60 ? f.value.substring(0, 60) + "..." : f.value, 15, y, { url: f.value });
        y += 6;
        doc.setTextColor(0, 0, 0);
      } else {
        addText(f.value, 15, 11);
      }
      y += 3;
    });

    // Scores
    y += 5;
    addText("SCORING BREAKDOWN", 15, 12, "bold", [134, 160, 105]);
    y += 2;
    const allEvals = getEvaluationsForApplicant(program.id, applicant.id);
    if (allEvals.length > 0) {
      allEvals.forEach(ev => {
        addText(`${ev.judgeName}:`, 15, 10, "bold");
        if (ev.mode === "scoring") {
          program.criteria.forEach(c => {
            addText(`  ${c.label}: ${ev.scores?.[c.id] || 0}/${c.maxScore}`, 20, 9);
          });
          addText(`  Total: ${ev.totalScore}/${maxTotal}`, 20, 10, "bold");
        } else {
          addText(`  Decision: ${ev.decision}`, 20, 10);
        }
        if (ev.notes) addText(`  Notes: ${ev.notes}`, 20, 9, "italic", [100, 100, 100]);
        y += 3;
      });
    } else {
      addText("No evaluations submitted yet.", 15, 10, "normal", [150, 150, 150]);
    }

    doc.save(`${applicant.name.replace(/\s+/g, "_")}_evaluation.pdf`);
  }, [program, applicant, getEvaluationsForApplicant, maxTotal]);

  if (!program) return <div className="p-8 text-muted-foreground font-body">Program not found.</div>;
  if (!applicant) return <div className="p-8 text-muted-foreground font-body">No applicants in this program.</div>;

  const scorePct = maxTotal > 0 ? (totalScore / maxTotal) * 100 : 0;
  const scoreColor = scorePct > 70 ? "bg-success" : scorePct > 40 ? "bg-warning" : "bg-destructive";

  const ScoringPanel = () => (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <p className="text-xs text-muted-foreground font-body">{program.title}</p>
        <p className="text-xs text-muted-foreground font-body mt-0.5">{currentIdx + 1} of {applicants.length}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
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
                className={`w-full h-14 rounded-lg border-2 text-sm font-body font-medium transition-all flex items-center justify-center gap-2 ${
                  decision === opt.value ? opt.activeBg + " border-transparent" : opt.color + " hover:bg-accent/50"
                }`}
              >
                {decision === opt.value && <Check className="w-4 h-4" />}
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-5 mb-6">
            {program.criteria.map(criterion => {
              const score = scores[criterion.id] || 0;
              return (
                <div key={criterion.id}>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="text-sm font-body font-medium">{criterion.label}</label>
                    <span className="text-xs font-body font-bold">{score}/{criterion.maxScore}</span>
                  </div>
                  {criterion.hint && <p className="text-[10px] text-muted-foreground font-body mb-2">{criterion.hint}</p>}
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={criterion.maxScore}
                      value={score}
                      onChange={e => setScores(prev => ({ ...prev, [criterion.id]: parseInt(e.target.value) }))}
                      className="flex-1 h-2 bg-accent rounded-sm appearance-none cursor-pointer touch-manipulation"
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
                      className="w-14 h-10 text-center border border-border rounded-lg text-sm font-body focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                </div>
              );
            })}

            <div className="pt-2 border-t border-border">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm font-body font-medium">Total</span>
                <span className="text-lg font-display">{totalScore} <span className="text-sm text-muted-foreground">/ {maxTotal}</span></span>
              </div>
              <div className="w-full h-2.5 bg-accent rounded-sm overflow-hidden">
                <div className={`h-full rounded-sm transition-all duration-300 ${scoreColor}`} style={{ width: `${scorePct}%` }} />
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs text-muted-foreground font-body mb-1">Internal notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-card text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            rows={3}
            placeholder="Your notes..."
          />
        </div>

        {/* Internal judges only: other evaluations */}
        {user?.isInternal && otherEvaluations.length > 0 && (
          <div className="mt-4 mb-4 border-t border-border pt-4">
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
          className={`w-full h-12 rounded-lg text-sm font-body font-medium transition-all ${
            saved ? "bg-success text-success-foreground animate-success-pulse" : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {saved ? "✓ Saved" : "Save & Next →"}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => handleSave(false)}
            className="flex-1 h-10 rounded-lg border border-border text-sm font-body hover:bg-accent transition-colors"
          >
            Save
          </button>
          <button
            onClick={handleExportPDF}
            className="h-10 px-3 rounded-lg border border-border text-sm font-body hover:bg-accent transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col animate-fade-in">
        {/* Mobile header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate(`/judge`)} className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <select
              className="font-display text-base bg-transparent border-none focus:ring-0 outline-none appearance-none text-center flex-1 mx-2"
              value={currentIdx}
              onChange={(e) => setCurrentIdx(Number(e.target.value))}
            >
              {applicants.map((app, idx) => (
                <option key={app.id} value={idx}>{idx + 1}. {app.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0} className="h-8 w-8 flex items-center justify-center border border-border rounded-lg disabled:opacity-30">
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setCurrentIdx(i => Math.min(applicants.length - 1, i + 1))} disabled={currentIdx === applicants.length - 1} className="h-8 w-8 flex items-center justify-center border border-border rounded-lg disabled:opacity-30">
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile toggle */}
        <div className="flex border-b border-border">
          <button onClick={() => setShowPanel(false)} className={`flex-1 py-3 text-sm font-body font-medium text-center transition-colors ${!showPanel ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground'}`}>
            Application
          </button>
          <button onClick={() => setShowPanel(true)} className={`flex-1 py-3 text-sm font-body font-medium text-center transition-colors ${showPanel ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground'}`}>
            Score
          </button>
        </div>

        {!showPanel ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {applicant.fields
              .filter(f => f.value.toLowerCase() !== "false" && f.value !== "")
              .map((f, i) => <FieldRenderer key={i} field={f} />)
            }
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <ScoringPanel />
          </div>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="h-[calc(100vh-56px)] flex animate-fade-in">
      {/* LEFT PANEL */}
      <div className="flex-[3] overflow-y-auto border-r border-border">
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
                  <option key={app.id} value={idx}>{idx + 1}. {app.name}</option>
                ))}
              </select>
            </div>
            <p className="text-[10px] text-muted-foreground font-body ml-8">
              Submitted {new Date(applicant.submittedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentIdx(i => i - 1)} disabled={currentIdx === 0} className="h-8 w-8 flex items-center justify-center border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-30">
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-muted-foreground font-body min-w-[40px] text-center">{currentIdx + 1} / {applicants.length}</span>
            <button onClick={() => setCurrentIdx(i => i + 1)} disabled={currentIdx === applicants.length - 1} className="h-8 w-8 flex items-center justify-center border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-30">
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {applicant.fields
            .filter(f => f.value.toLowerCase() !== "false" && f.value !== "")
            .map((f, i) => <FieldRenderer key={i} field={f} />)
          }
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-[2] max-w-md p-6 overflow-y-auto flex flex-col">
        <ScoringPanel />
      </div>
    </div>
  );
};

function FieldRenderer({ field }: { field: ApplicantField }) {
  // Boolean field
  if (field.type === "boolean") {
    return (
      <div>
        <p className="text-xs text-muted-foreground font-body mb-1">{field.label}</p>
        <span className={`inline-block text-sm font-body font-medium px-3 py-1 rounded-lg ${field.booleanValue ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
          {field.booleanValue ? "Yes" : "No"}
        </span>
      </div>
    );
  }

  // Multi-select field
  if (field.type === "multiselect" && field.selectedOptions) {
    return (
      <div>
        <p className="text-xs text-muted-foreground font-body mb-1">{field.label}</p>
        <div className="flex flex-wrap gap-1.5">
          {field.selectedOptions.map((opt, i) => (
            <span key={i} className="text-xs font-body px-2.5 py-1 bg-primary/10 text-primary rounded-lg">{opt}</span>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "file" || field.fileType) {
    const ft = field.fileType;
    if (ft === "image") {
      return (
        <div>
          <p className="text-xs text-muted-foreground font-body mb-1">{field.label}</p>
          <img src={field.value} alt={field.label} className="w-full max-w-full rounded-lg border border-border" loading="lazy" />
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
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe src={embedUrl} className="absolute inset-0 w-full h-full rounded-lg border border-border" allowFullScreen />
          </div>
        </div>
      );
    }
    if (ft === "video") {
      return (
        <div>
          <p className="text-xs text-muted-foreground font-body mb-1">{field.label}</p>
          <video src={field.value} controls className="w-full max-w-full rounded-lg border border-border" />
        </div>
      );
    }
    if (ft === "pdf") {
      return (
        <div>
          <p className="text-xs text-muted-foreground font-body mb-1">{field.label}</p>
          <iframe src={field.value} className="w-full h-[50vh] min-h-[300px] rounded-lg border border-border bg-card" title={field.label} />
          <a href={field.value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 p-2.5 border border-border rounded-lg hover:bg-accent transition-colors text-xs font-body text-primary">
            <FileText className="w-3 h-3" /> Open PDF in new tab ↗
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
        <p className="text-sm font-body leading-relaxed break-words">{field.value}</p>
      ) : (
        <p className="text-sm font-body font-medium break-words">{field.value}</p>
      )}
    </div>
  );
}

export default EvaluationView;
