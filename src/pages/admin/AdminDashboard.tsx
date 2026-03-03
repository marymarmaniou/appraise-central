import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { Program, Criterion } from "@/lib/types";
import { Plus, Users, FileText, BarChart3 } from "lucide-react";

const AdminDashboard = () => {
  const { programs, addProgram, getProgramProgress, getEvaluationsForProgram } = useApp();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl sm:text-3xl font-display">Programs</h1>
        <button
          onClick={() => setShowModal(true)}
          className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium font-body hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Program</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {programs.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm font-body">No programs yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((program, i) => (
            <ProgramCard key={program.id} program={program} index={i} onClick={() => navigate(`/admin/program/${program.id}`)} />
          ))}
        </div>
      )}

      {showModal && <NewProgramModal onClose={() => setShowModal(false)} onSave={addProgram} />}
    </div>
  );
};

function ProgramCard({ program, index, onClick }: { program: Program; index: number; onClick: () => void }) {
  const { getProgramProgress, getEvaluationsForProgram } = useApp();
  const progress = getProgramProgress(program.id);
  const evals = getEvaluationsForProgram(program.id);
  const pct = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  const avgScore = program.mode === "scoring" && evals.length > 0
    ? (evals.reduce((s, e) => s + (e.totalScore || 0), 0) / evals.length).toFixed(1)
    : null;

  return (
    <button
      onClick={onClick}
      className="text-left p-5 bg-card border border-border rounded-lg hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 animate-slide-up group"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-display text-lg leading-tight">{program.title}</h3>
        <span className={`text-[10px] font-body font-medium px-2 py-0.5 rounded ${
          program.mode === "scoring" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
        }`}>
          {program.mode}
        </span>
      </div>
      <p className="text-muted-foreground text-xs font-body line-clamp-2 mb-4">{program.description}</p>

      <div className="flex items-center gap-4 text-xs text-muted-foreground font-body mb-3">
        <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {program.applicants.length}</span>
        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {program.judges.length}</span>
        {avgScore && <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {avgScore} avg</span>}
      </div>

      <div className="w-full h-1.5 bg-accent rounded-sm overflow-hidden">
        <div className="h-full bg-primary rounded-sm animate-progress-fill transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground font-body mt-1">{progress.completed} of {progress.total} evaluations</p>
    </button>
  );
}

function NewProgramModal({ onClose, onSave }: { onClose: () => void; onSave: (p: Program) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"scoring" | "triage">("scoring");
  const [criteria, setCriteria] = useState<Criterion[]>([
    { id: crypto.randomUUID(), label: "", maxScore: 5, hint: "" },
  ]);

  const addCriterion = () => {
    if (criteria.length < 8) setCriteria([...criteria, { id: crypto.randomUUID(), label: "", maxScore: 5, hint: "" }]);
  };

  const updateCriterion = (idx: number, field: string, value: string | number) => {
    setCriteria(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const removeCriterion = (idx: number) => {
    setCriteria(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!title.trim()) return;
    const program: Program = {
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
      createdAt: new Date().toISOString(),
      mode,
      criteria: mode === "scoring" ? criteria.filter(c => c.label.trim()) : [],
      judges: [],
      applicants: [],
    };
    onSave(program);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-full max-w-lg p-6 animate-scale-in max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="font-display text-xl mb-4">New Program</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 font-body">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full h-10 px-3 border border-border rounded-lg bg-background text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="e.g. Artist Residency Q3" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 font-body">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" rows={2} placeholder="Brief description..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 font-body">Evaluation Mode</label>
            <div className="flex gap-2">
              {(["scoring", "triage"] as const).map(m => (
                <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 h-10 rounded-lg border text-sm font-medium font-body transition-all ${mode === m ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary/30"}`}>
                  {m === "scoring" ? "Scoring" : "Triage"}
                </button>
              ))}
            </div>
          </div>

          {mode === "scoring" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2 font-body">Criteria (up to 8)</label>
              <div className="space-y-2">
                {criteria.map((c, i) => (
                  <div key={c.id} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <input value={c.label} onChange={e => updateCriterion(i, "label", e.target.value)} className="w-full h-8 px-2 border border-border rounded bg-background text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20" placeholder="Criterion name" />
                    </div>
                    <input type="number" value={c.maxScore} onChange={e => updateCriterion(i, "maxScore", parseInt(e.target.value) || 1)} className="w-14 h-8 px-2 border border-border rounded bg-background text-xs font-body text-center focus:outline-none" min={1} max={100} />
                    <button onClick={() => removeCriterion(i)} className="text-muted-foreground hover:text-destructive text-xs h-8 px-1">✕</button>
                  </div>
                ))}
              </div>
              {criteria.length < 8 && (
                <button onClick={addCriterion} className="text-xs text-primary font-body mt-2 hover:underline">+ Add criterion</button>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-border text-sm font-body hover:bg-accent transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!title.trim()} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium font-body hover:bg-primary/90 transition-colors disabled:opacity-40">Create Program</button>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
