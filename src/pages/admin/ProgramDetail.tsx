import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Applicant, ApplicantField, Evaluation } from "@/lib/types";
import { ArrowLeft, Upload, Plus, X, FileText, User, ChevronRight, RefreshCw, Download } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import jsPDF from "jspdf";

const ProgramDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { programs, updateProgram, addApplicants, addJudge, removeJudge, getEvaluationsForProgram, getEvaluationsForApplicant, getProgramProgress, getJudgeProgress } = useApp();
  const program = programs.find(p => p.id === id);
  const [tab, setTab] = useState<"applications" | "judges" | "results" | "settings">("applications");
  const [selectedApplicant, setSelectedApplicant] = useState<string | null>(null);

  if (!program) return <div className="p-8 text-muted-foreground font-body">Program not found.</div>;

  const evals = getEvaluationsForProgram(program.id);
  const progress = getProgramProgress(program.id);
  const tabs = ["applications", "judges", "results", "settings"] as const;

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate("/admin")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground font-body mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Programs
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display">{program.title}</h1>
          <p className="text-sm text-muted-foreground font-body mt-1">{program.description}</p>
        </div>
        <span className={`self-start text-xs font-body font-medium px-2.5 py-1 rounded ${program.mode === "scoring" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"}`}>
          {program.mode}
        </span>
      </div>

      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 sm:px-4 py-2.5 text-sm font-body font-medium capitalize transition-colors relative whitespace-nowrap ${tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t}
            {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        ))}
      </div>

      {tab === "applications" && <ApplicationsTab program={program} evals={evals} onSelect={setSelectedApplicant} />}
      {tab === "judges" && <JudgesTab program={program} onAdd={addJudge} onRemove={removeJudge} />}
      {tab === "results" && <ResultsTab program={program} evals={evals} />}
      {tab === "settings" && <SettingsTab program={program} onUpdate={updateProgram} onImport={addApplicants} />}

      {selectedApplicant && (
        <ApplicantDetailModal
          program={program}
          applicantId={selectedApplicant}
          evals={getEvaluationsForApplicant(program.id, selectedApplicant)}
          onClose={() => setSelectedApplicant(null)}
        />
      )}
    </div>
  );
};

function ApplicationsTab({ program, evals, onSelect }: { program: any; evals: Evaluation[]; onSelect: (id: string) => void }) {
  const isMobile = useIsMobile();

  if (program.applicants.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground font-body">No applicants yet. Import them in Settings.</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-2">
        {program.applicants.map((app: any) => {
          const appEvals = evals.filter(e => e.applicantId === app.id);
          const evalPct = program.judges.length > 0 ? (appEvals.length / program.judges.length) * 100 : 0;
          const avgScore = program.mode === "scoring" && appEvals.length > 0
            ? (appEvals.reduce((s: number, e: Evaluation) => s + (e.totalScore || 0), 0) / appEvals.length).toFixed(1) : "—";
          return (
            <button key={app.id} onClick={() => onSelect(app.id)} className="w-full text-left p-4 border border-border rounded-lg bg-card hover:bg-accent/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium font-body">{app.name}</p>
                <span className="text-sm font-bold font-body">{avgScore}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-accent rounded-sm overflow-hidden">
                  <div className="h-full bg-primary rounded-sm" style={{ width: `${evalPct}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground font-body">{new Date(app.submittedAt).toLocaleDateString()}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-accent/50">
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground font-body">Name</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground font-body hidden md:table-cell">Submitted</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground font-body hidden lg:table-cell">Fields</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground font-body">Progress</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground font-body">
              {program.mode === "scoring" ? "Avg" : "Consensus"}
            </th>
          </tr>
        </thead>
        <tbody>
          {program.applicants.map((app: any) => {
            const appEvals = evals.filter(e => e.applicantId === app.id);
            const evalPct = program.judges.length > 0 ? (appEvals.length / program.judges.length) * 100 : 0;
            const avgScore = program.mode === "scoring" && appEvals.length > 0
              ? (appEvals.reduce((s: number, e: Evaluation) => s + (e.totalScore || 0), 0) / appEvals.length).toFixed(1) : "—";
            const textFields = app.fields.filter((f: ApplicantField) => f.type === "text").slice(0, 3);

            return (
              <tr key={app.id} onClick={() => onSelect(app.id)} className="border-t border-border hover:bg-accent/30 cursor-pointer transition-colors">
                <td className="px-4 py-3 text-sm font-medium font-body">{app.name}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-body hidden md:table-cell">{new Date(app.submittedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-body hidden lg:table-cell">
                  {textFields.map((f: ApplicantField) => f.value).join(" · ")}
                </td>
                <td className="px-4 py-3">
                  <div className="w-16 h-1.5 bg-accent rounded-sm overflow-hidden">
                    <div className="h-full bg-primary rounded-sm" style={{ width: `${evalPct}%` }} />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-body font-medium">{avgScore}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function JudgesTab({ program, onAdd, onRemove }: { program: any; onAdd: (pid: string, name: string) => void; onRemove: (pid: string, name: string) => void }) {
  const [name, setName] = useState("");
  const { getJudgeProgress } = useApp();

  const handleAdd = () => {
    if (name.trim()) { onAdd(program.id, name.trim()); setName(""); }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} className="flex-1 sm:flex-none sm:w-64 h-10 px-3 border border-border rounded-lg bg-card text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Judge name" />
        <button onClick={handleAdd} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-body font-medium hover:bg-primary/90 transition-colors flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {program.judges.length === 0 ? (
        <div className="text-center py-12">
          <User className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-body">No judges assigned yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {program.judges.map((judge: string) => {
            const prog = getJudgeProgress(program.id, judge);
            const pct = prog.total > 0 ? (prog.completed / prog.total) * 100 : 0;
            return (
              <div key={judge} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-body font-medium">{judge.charAt(0)}</div>
                  <div>
                    <p className="text-sm font-medium font-body">{judge}</p>
                    <p className="text-xs text-muted-foreground font-body">{prog.completed} of {prog.total} reviewed</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-1.5 bg-accent rounded-sm overflow-hidden hidden sm:block">
                    <div className="h-full bg-primary rounded-sm" style={{ width: `${pct}%` }} />
                  </div>
                  <button onClick={() => onRemove(program.id, judge)} className="text-muted-foreground hover:text-destructive transition-colors"><X className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResultsTab({ program, evals }: { program: any; evals: Evaluation[] }) {
  const isMobile = useIsMobile();
  const results = useMemo(() => {
    return program.applicants.map((app: any) => {
      const appEvals = evals.filter(e => e.applicantId === app.id);
      if (program.mode === "scoring") {
        const avgTotal = appEvals.length > 0 ? appEvals.reduce((s: number, e: Evaluation) => s + (e.totalScore || 0), 0) / appEvals.length : 0;
        const criteriaAvgs: Record<string, number> = {};
        program.criteria.forEach((c: any) => {
          const scores = appEvals.map(e => e.scores?.[c.id] || 0);
          criteriaAvgs[c.id] = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
        });
        return { ...app, avgTotal, criteriaAvgs, evalCount: appEvals.length };
      } else {
        const yes = appEvals.filter(e => e.decision === "yes").length;
        const no = appEvals.filter(e => e.decision === "no").length;
        const review = appEvals.filter(e => e.decision === "review").length;
        return { ...app, yes, no, review, evalCount: appEvals.length };
      }
    }).sort((a: any, b: any) => program.mode === "scoring" ? (b.avgTotal - a.avgTotal) : (b.yes - a.yes));
  }, [program, evals]);

  if (results.length === 0) return <p className="text-sm text-muted-foreground font-body py-8 text-center">No applicants to show.</p>;

  if (isMobile) {
    return (
      <div className="space-y-2">
        {results.map((r: any, i: number) => (
          <div key={r.id} className="p-4 border border-border rounded-lg bg-card">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium font-body">#{i + 1} {r.name}</p>
              {program.mode === "scoring" ? (
                <span className="text-sm font-bold font-body text-primary">{r.avgTotal.toFixed(1)}</span>
              ) : (
                <div className="flex gap-2 text-xs font-body">
                  <span className="text-success">{r.yes}Y</span>
                  <span className="text-destructive">{r.no}N</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground font-body">{r.evalCount} reviews</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-accent/50">
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground font-body">#</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground font-body">Applicant</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground font-body">Reviews</th>
            {program.mode === "scoring" ? (
              <>
                {program.criteria.map((c: any) => (
                  <th key={c.id} className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground font-body hidden lg:table-cell">{c.label.split(" ")[0]}</th>
                ))}
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground font-body">Avg</th>
              </>
            ) : (
              <>
                <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground font-body">Yes</th>
                <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground font-body">No</th>
                <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground font-body">Review</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {results.map((r: any, i: number) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-4 py-3 text-xs text-muted-foreground font-body">{i + 1}</td>
              <td className="px-4 py-3 text-sm font-medium font-body">{r.name}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground font-body">{r.evalCount}</td>
              {program.mode === "scoring" ? (
                <>
                  {program.criteria.map((c: any) => (
                    <td key={c.id} className="text-center px-3 py-3 text-xs font-body hidden lg:table-cell">{r.criteriaAvgs[c.id]?.toFixed(1)}</td>
                  ))}
                  <td className="text-center px-4 py-3 text-sm font-bold font-body text-primary">{r.avgTotal.toFixed(1)}</td>
                </>
              ) : (
                <>
                  <td className="text-center px-3 py-3 text-xs font-body text-success">{r.yes}</td>
                  <td className="text-center px-3 py-3 text-xs font-body text-destructive">{r.no}</td>
                  <td className="text-center px-3 py-3 text-xs font-body text-warning">{r.review}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsTab({ program, onUpdate, onImport }: { program: any; onUpdate: (p: any) => void; onImport: (pid: string, apps: Applicant[]) => void }) {
  const [title, setTitle] = useState(program.title);
  const [desc, setDesc] = useState(program.description);
  const [importMode, setImportMode] = useState<"csv" | "json" | null>(null);

  const handleSave = () => {
    onUpdate({ ...program, title, description: desc });
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1 font-body">Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="w-full h-10 px-3 border border-border rounded-lg bg-card text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1 font-body">Description</label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" rows={2} />
      </div>
      <button onClick={handleSave} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-body font-medium hover:bg-primary/90 transition-colors">Save Changes</button>

      <hr className="border-border" />
      <TallyWebhookSync programId={program.id} onImport={onImport} />
      <hr className="border-border" />

      <div>
        <h3 className="font-display text-lg mb-3">Import Applicants</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={() => setImportMode("csv")} className={`h-10 px-4 rounded-lg border text-sm font-body transition-all ${importMode === "csv" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/30"}`}>
            <Upload className="w-3.5 h-3.5 inline mr-1" /> CSV / XLSX Upload
          </button>
          <button onClick={() => setImportMode("json")} className={`h-10 px-4 rounded-lg border text-sm font-body transition-all ${importMode === "json" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/30"}`}>
            {"{ }"} JSON Paste
          </button>
        </div>

        {importMode === "csv" && <CSVImporter programId={program.id} onImport={onImport} />}
        {importMode === "json" && <JSONImporter programId={program.id} onImport={onImport} />}
      </div>
    </div>
  );
}

function detectFileType(url: string): { type: "file"; fileType: import("@/lib/types").FileType } | { type: "text" } {
  if (!url || typeof url !== "string") return { type: "text" };
  const lower = url.toLowerCase();
  const pathOnly = lower.split("?")[0];
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return { type: "file", fileType: "youtube" };
  if (lower.includes("vimeo.com")) return { type: "file", fileType: "vimeo" };
  if (pathOnly.match(/\.(pdf)$/)) return { type: "file", fileType: "pdf" };
  if (pathOnly.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return { type: "file", fileType: "image" };
  if (pathOnly.match(/\.(mp4|webm|mov|wav|mp3|m4a)$/)) return { type: "file", fileType: "video" };
  if (pathOnly.match(/\.(xlsx|xls|csv)$/)) return { type: "file", fileType: "excel" };
  if (pathOnly.match(/\.(docx|doc)$/)) return { type: "file", fileType: "word" };
  if (lower.startsWith("http")) return { type: "file", fileType: "unknown" };
  return { type: "text" };
}

function TallyWebhookSync({ programId, onImport }: { programId: string; onImport: (pid: string, apps: Applicant[]) => void }) {
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tally-webhook`;

  const fetchNewApplicants = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("webhook_applicants")
        .select("*")
        .eq("imported", false)
        .order("submitted_at", { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) { setCount(0); return; }

      const applicants: Applicant[] = data.map((row: any) => ({
        id: row.id,
        name: row.applicant_name,
        submittedAt: row.submitted_at,
        fields: (row.fields as any[]).map((f: any) => ({
          label: f.label,
          type: f.type || "text",
          value: f.value,
          ...(f.fileType ? { fileType: f.fileType } : {}),
        })),
      }));

      onImport(programId, applicants);
      const ids = data.map((r: any) => r.id);
      await supabase.from("webhook_applicants").update({ imported: true }).in("id", ids);
      setCount(applicants.length);
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setLoading(false);
    }
  }, [programId, onImport]);

  return (
    <div>
      <h3 className="font-display text-lg mb-3">Tally Webhook (Live Sync)</h3>
      <div className="p-4 border border-border rounded-lg bg-card space-y-3">
        <div>
          <p className="text-xs text-muted-foreground font-body mb-1">Webhook URL (paste into Tally → Integrations → Webhooks)</p>
          <div className="flex gap-2">
            <input readOnly value={webhookUrl} className="flex-1 h-8 px-3 border border-border rounded bg-accent text-xs font-mono font-body focus:outline-none" onClick={(e) => (e.target as HTMLInputElement).select()} />
            <button onClick={() => navigator.clipboard.writeText(webhookUrl)} className="h-8 px-3 border border-border rounded text-xs font-body hover:bg-accent transition-colors">Copy</button>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={fetchNewApplicants} disabled={loading} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-body font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Syncing..." : "Pull New Submissions"}
          </button>
          {count !== null && (
            <p className="text-xs text-muted-foreground font-body">
              {count === 0 ? "No new submissions" : `Imported ${count} new applicant${count > 1 ? "s" : ""}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CSVImporter({ programId, onImport }: { programId: string; onImport: (pid: string, apps: Applicant[]) => void }) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});

  const processData = (data: string[][]) => {
    if (data.length > 0) {
      setHeaders(data[0]);
      setRows(data.slice(1).filter(r => r.some(c => c && c.toString().trim())));
      const autoMap: Record<number, string> = {};
      data[0].forEach((h, i) => {
        const lower = (h || "").toLowerCase();
        if (lower === "full name" || lower === "name") autoMap[i] = "name";
        else if (lower.includes("submitted at") || lower.includes("submitted_at") || lower.includes("submission date")) autoMap[i] = "date";
        else if (lower.includes("submission id") || lower.includes("respondent id")) autoMap[i] = "skip";
        else autoMap[i] = "field";
      });
      setMapping(autoMap);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const wb = XLSX.read(evt.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
        processData(data.map(row => row.map(cell => String(cell ?? ""))));
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, { complete: (result) => { processData(result.data as string[][]); } });
    }
  };

  const handleImport = () => {
    const applicants: Applicant[] = rows.map(row => {
      let name = "";
      let date = new Date().toISOString();
      const fields: ApplicantField[] = [];
      headers.forEach((h, i) => {
        const m = mapping[i];
        const val = row[i] || "";
        if (m === "name") name = val;
        else if (m === "date") date = val || date;
        else if (m === "field") {
          const detected = detectFileType(val);
          fields.push({
            label: h,
            type: detected.type as any,
            value: val,
            ...(detected.type === "file" ? { fileType: (detected as any).fileType } : {}),
          });
        }
      });
      return { id: crypto.randomUUID(), name: name || "Unnamed", submittedAt: date, fields };
    });
    onImport(programId, applicants);
    setHeaders([]);
    setRows([]);
  };

  if (headers.length === 0) {
    return (
      <div className="mt-4">
        <label className="block w-full border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/40 transition-colors">
          <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-body">Click to upload CSV or XLSX</p>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
        </label>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4 animate-fade-in">
      <h4 className="text-sm font-medium font-body">Map Fields</h4>
      <div className="space-y-2">
        {headers.map((h, i) => (
          <div key={i} className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-body text-muted-foreground w-32 truncate">{h}</span>
            <span className="text-muted-foreground">→</span>
            <select value={mapping[i] || "field"} onChange={e => setMapping(prev => ({ ...prev, [i]: e.target.value }))} className="h-8 px-2 border border-border rounded bg-card text-xs font-body focus:outline-none">
              <option value="name">Applicant Name</option>
              <option value="date">Submission Date</option>
              <option value="field">Custom Field</option>
              <option value="skip">Skip</option>
            </select>
          </div>
        ))}
      </div>

      <div>
        <h4 className="text-xs font-medium text-muted-foreground font-body mb-2">Preview (first 3 rows)</h4>
        <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-xs font-body">
            <thead><tr className="bg-accent/50">{headers.map((h, i) => <th key={i} className="px-3 py-2 text-left text-muted-foreground whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>{rows.slice(0, 3).map((row, i) => <tr key={i} className="border-t border-border">{row.map((c, j) => <td key={j} className="px-3 py-2 truncate max-w-[150px]">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>

      <button onClick={handleImport} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-body font-medium hover:bg-primary/90 transition-colors">
        Import {rows.length} applicants
      </button>
    </div>
  );
}

function JSONImporter({ programId, onImport }: { programId: string; onImport: (pid: string, apps: Applicant[]) => void }) {
  const [json, setJson] = useState("");
  const [preview, setPreview] = useState<any[] | null>(null);
  const [error, setError] = useState("");

  const handleParse = () => {
    try {
      const data = JSON.parse(json);
      if (!Array.isArray(data)) throw new Error("Must be an array");
      setPreview(data);
      setError("");
    } catch (e: any) {
      setError(e.message);
      setPreview(null);
    }
  };

  const handleImport = () => {
    if (!preview) return;
    const applicants: Applicant[] = preview.map((item: any) => ({
      id: crypto.randomUUID(),
      name: item.name || "Unnamed",
      submittedAt: item.submittedAt || new Date().toISOString(),
      fields: Object.entries(item).filter(([k]) => !["name", "submittedAt", "id"].includes(k)).map(([k, v]) => {
        const detected = detectFileType(String(v));
        return { label: k, type: detected.type as any, value: String(v), ...(detected.type === "file" ? { fileType: (detected as any).fileType } : {}) };
      }),
    }));
    onImport(programId, applicants);
    setJson("");
    setPreview(null);
  };

  return (
    <div className="mt-4 space-y-3 animate-fade-in">
      <textarea value={json} onChange={e => setJson(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-xs font-mono font-body focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" rows={8} placeholder='[{"name": "...", "email": "...", ...}]' />
      {error && <p className="text-destructive text-xs font-body">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleParse} className="h-10 px-4 border border-border rounded-lg text-sm font-body hover:bg-accent transition-colors">Parse</button>
        {preview && (
          <button onClick={handleImport} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-body font-medium hover:bg-primary/90 transition-colors">
            Import {preview.length} applicants
          </button>
        )}
      </div>
      {preview && (
        <p className="text-xs text-muted-foreground font-body">{preview.length} applicants parsed. First: <strong>{preview[0]?.name}</strong> with {Object.keys(preview[0] || {}).length} fields.</p>
      )}
    </div>
  );
}

function ApplicantDetailModal({ program, applicantId, evals, onClose }: { program: any; applicantId: string; evals: Evaluation[]; onClose: () => void }) {
  const applicant = program.applicants.find((a: any) => a.id === applicantId);
  const isMobile = useIsMobile();
  const { getEvaluationsForApplicant } = useApp();
  if (!applicant) return null;

  const maxTotal = program.criteria.reduce((s: number, c: any) => s + c.maxScore, 0);
  const avgScore = evals.length > 0 ? (evals.reduce((s, e) => s + (e.totalScore || 0), 0) / evals.length) : 0;

  const handleExportPDF = () => {
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

    addText(program.title, 15, 18, "bold", [134, 160, 105]);
    addText(`Applicant: ${applicant.name}`, 15, 14, "bold");
    addText(`Submitted: ${new Date(applicant.submittedAt).toLocaleDateString()}`, 15, 10, "normal", [120, 120, 120]);
    y += 5;

    applicant.fields.forEach((f: ApplicantField) => {
      if (f.value.toLowerCase() === "false" || f.value === "") return;
      addText(f.label, 15, 10, "bold", [100, 100, 100]);
      if (f.type === "file" || f.fileType) {
        doc.setTextColor(134, 160, 105);
        doc.textWithLink(f.value.length > 60 ? f.value.substring(0, 60) + "..." : f.value, 15, y, { url: f.value });
        y += 6;
        doc.setTextColor(0, 0, 0);
      } else if (f.type === "boolean") {
        addText(f.booleanValue ? "Yes" : "No", 15, 11);
      } else if (f.type === "multiselect" && f.selectedOptions) {
        addText(f.selectedOptions.join(", "), 15, 11);
      } else {
        addText(f.value, 15, 11);
      }
      y += 3;
    });

    y += 5;
    addText("SCORING BREAKDOWN", 15, 12, "bold", [134, 160, 105]);
    y += 2;
    if (evals.length > 0) {
      evals.forEach(ev => {
        addText(`${ev.judgeName}:`, 15, 10, "bold");
        if (ev.mode === "scoring") {
          program.criteria.forEach((c: any) => {
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
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`bg-card border border-border rounded-lg w-full max-h-[90vh] overflow-hidden animate-scale-in ${isMobile ? 'flex flex-col' : 'max-w-4xl flex'}`} onClick={e => e.stopPropagation()}>
        {/* Left - Applicant Info */}
        <div className={`${isMobile ? 'max-h-[50vh]' : 'flex-1 border-r border-border'} p-4 sm:p-6 overflow-y-auto`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-display text-xl sm:text-2xl mb-1">{applicant.name}</h2>
              <p className="text-xs text-muted-foreground font-body">Submitted {new Date(applicant.submittedAt).toLocaleDateString()}</p>
            </div>
            <button onClick={handleExportPDF} className="h-9 px-3 rounded-lg border border-border text-xs font-body hover:bg-accent transition-colors flex items-center gap-1.5 shrink-0">
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
          <div className="space-y-3">
            {applicant.fields.map((f: ApplicantField, i: number) => (
              <FieldRenderer key={i} field={f} />
            ))}
          </div>
        </div>

        {/* Right - Evaluations */}
        <div className={`${isMobile ? 'border-t' : 'w-80'} p-4 sm:p-6 overflow-y-auto`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg">Evaluations</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>

          {program.mode === "scoring" && evals.length > 0 && (
            <div className="mb-4 p-3 bg-primary/10 rounded-lg">
              <p className="text-xs text-muted-foreground font-body mb-1">Average Score</p>
              <p className="text-2xl font-display text-primary">{avgScore.toFixed(1)} <span className="text-sm text-muted-foreground">/ {maxTotal}</span></p>
            </div>
          )}

          {evals.length === 0 ? (
            <p className="text-sm text-muted-foreground font-body">No evaluations yet.</p>
          ) : (
            <div className="space-y-3">
              {evals.map((ev, i) => (
                <div key={i} className="border border-border rounded-lg p-3">
                  <p className="text-sm font-medium font-body mb-1">{ev.judgeName}</p>
                  {program.mode === "scoring" ? (
                    <>
                      <div className="space-y-1 mb-2">
                        {program.criteria.map((c: any) => (
                          <div key={c.id} className="flex justify-between text-xs font-body">
                            <span className="text-muted-foreground">{c.label.split(" ")[0]}</span>
                            <span>{ev.scores?.[c.id] || 0}/{c.maxScore}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-sm font-bold font-body">Total: {ev.totalScore}/{maxTotal}</p>
                    </>
                  ) : (
                    <span className={`text-xs font-body font-medium px-2 py-0.5 rounded ${ev.decision === "yes" ? "bg-success/10 text-success" : ev.decision === "no" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                      {ev.decision}
                    </span>
                  )}
                  {ev.notes && <p className="text-xs text-muted-foreground font-body mt-2 italic">"{ev.notes}"</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldRenderer({ field }: { field: ApplicantField }) {
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

export default ProgramDetail;
