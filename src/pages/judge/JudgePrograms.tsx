import { useApp } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FileText } from "lucide-react";

const JudgePrograms = () => {
  const { user, programs, getJudgeProgress } = useApp();
  const navigate = useNavigate();

  const myPrograms = programs.filter(p => user && p.judges.includes(user.name));

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl sm:text-3xl font-display mb-6">My Programs</h1>

      {myPrograms.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm font-body">You're not assigned to any programs yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myPrograms.map((program, i) => {
            const prog = getJudgeProgress(program.id, user!.name);
            const pct = prog.total > 0 ? (prog.completed / prog.total) * 100 : 0;
            const isComplete = prog.completed === prog.total && prog.total > 0;

            return (
              <button
                key={program.id}
                onClick={() => navigate(`/judge/program/${program.id}`)}
                className="w-full text-left p-4 sm:p-5 bg-card border border-border rounded-lg hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 animate-slide-up flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div>
                  <h3 className="font-display text-lg">{program.title}</h3>
                  <p className="text-xs text-muted-foreground font-body mt-0.5">
                    {prog.completed} of {prog.total} reviewed
                    {isComplete && <span className="text-success ml-2">✓ Complete</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-accent rounded-sm overflow-hidden">
                    <div className={`h-full rounded-sm animate-progress-fill ${isComplete ? "bg-success" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`text-xs font-body font-medium px-2 py-0.5 rounded ${program.mode === "scoring" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"}`}>
                    {program.mode}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default JudgePrograms;
