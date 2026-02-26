import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Program, Evaluation, AuthUser, Applicant, Criterion } from "@/lib/types";
import { SAMPLE_PROGRAM, SAMPLE_EVALUATIONS } from "@/lib/sample-data";

interface AppState {
  user: AuthUser | null;
  programs: Program[];
  evaluations: Evaluation[];
}

interface AppContextType extends AppState {
  login: (user: AuthUser) => void;
  logout: () => void;
  addProgram: (program: Program) => void;
  updateProgram: (program: Program) => void;
  deleteProgram: (id: string) => void;
  addApplicants: (programId: string, applicants: Applicant[]) => void;
  addJudge: (programId: string, name: string) => void;
  removeJudge: (programId: string, name: string) => void;
  saveEvaluation: (evaluation: Evaluation) => void;
  getEvaluationsForProgram: (programId: string) => Evaluation[];
  getEvaluationsForApplicant: (programId: string, applicantId: string) => Evaluation[];
  getJudgeEvaluation: (programId: string, applicantId: string, judgeName: string) => Evaluation | undefined;
  getProgramProgress: (programId: string) => { completed: number; total: number };
  getJudgeProgress: (programId: string, judgeName: string) => { completed: number; total: number };
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = "jurybox-state";

function loadState(): { programs: Program[]; evaluations: Evaluation[] } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return { programs: [SAMPLE_PROGRAM], evaluations: SAMPLE_EVALUATIONS };
}

function saveState(programs: Program[], evaluations: Evaluation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ programs, evaluations }));
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const u = sessionStorage.getItem("jurybox-user");
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  });
  const [programs, setPrograms] = useState<Program[]>(() => loadState().programs);
  const [evaluations, setEvaluations] = useState<Evaluation[]>(() => loadState().evaluations);

  useEffect(() => { saveState(programs, evaluations); }, [programs, evaluations]);

  const login = useCallback((u: AuthUser) => {
    setUser(u);
    sessionStorage.setItem("jurybox-user", JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem("jurybox-user");
  }, []);

  const addProgram = useCallback((p: Program) => setPrograms(prev => [...prev, p]), []);
  const updateProgram = useCallback((p: Program) => setPrograms(prev => prev.map(x => x.id === p.id ? p : x)), []);
  const deleteProgram = useCallback((id: string) => {
    setPrograms(prev => prev.filter(x => x.id !== id));
    setEvaluations(prev => prev.filter(e => e.programId !== id));
  }, []);

  const addApplicants = useCallback((programId: string, applicants: Applicant[]) => {
    setPrograms(prev => prev.map(p => p.id === programId ? { ...p, applicants: [...p.applicants, ...applicants] } : p));
  }, []);

  const addJudge = useCallback((programId: string, name: string) => {
    setPrograms(prev => prev.map(p => p.id === programId && !p.judges.includes(name) ? { ...p, judges: [...p.judges, name] } : p));
  }, []);

  const removeJudge = useCallback((programId: string, name: string) => {
    setPrograms(prev => prev.map(p => p.id === programId ? { ...p, judges: p.judges.filter(j => j !== name) } : p));
  }, []);

  const saveEvaluation = useCallback((evaluation: Evaluation) => {
    setEvaluations(prev => {
      const idx = prev.findIndex(e => e.programId === evaluation.programId && e.applicantId === evaluation.applicantId && e.judgeName === evaluation.judgeName);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = evaluation;
        return next;
      }
      return [...prev, evaluation];
    });
  }, []);

  const getEvaluationsForProgram = useCallback((programId: string) => evaluations.filter(e => e.programId === programId), [evaluations]);
  const getEvaluationsForApplicant = useCallback((programId: string, applicantId: string) => evaluations.filter(e => e.programId === programId && e.applicantId === applicantId), [evaluations]);
  const getJudgeEvaluation = useCallback((programId: string, applicantId: string, judgeName: string) => evaluations.find(e => e.programId === programId && e.applicantId === applicantId && e.judgeName === judgeName), [evaluations]);

  const getProgramProgress = useCallback((programId: string) => {
    const program = programs.find(p => p.id === programId);
    if (!program) return { completed: 0, total: 0 };
    const total = program.applicants.length * program.judges.length;
    const completed = evaluations.filter(e => e.programId === programId).length;
    return { completed, total };
  }, [programs, evaluations]);

  const getJudgeProgress = useCallback((programId: string, judgeName: string) => {
    const program = programs.find(p => p.id === programId);
    if (!program) return { completed: 0, total: 0 };
    const total = program.applicants.length;
    const completed = evaluations.filter(e => e.programId === programId && e.judgeName === judgeName).length;
    return { completed, total };
  }, [programs, evaluations]);

  return (
    <AppContext.Provider value={{
      user, programs, evaluations, login, logout, addProgram, updateProgram, deleteProgram,
      addApplicants, addJudge, removeJudge, saveEvaluation,
      getEvaluationsForProgram, getEvaluationsForApplicant, getJudgeEvaluation,
      getProgramProgress, getJudgeProgress,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
