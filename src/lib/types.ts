export type EvaluationMode = "triage" | "scoring";
export type TriageDecision = "yes" | "no" | "review";
export type FieldType = "text" | "url" | "file";
export type FileType = "pdf" | "image" | "video" | "excel" | "word" | "youtube" | "vimeo" | "unknown";

export interface Criterion {
  id: string;
  label: string;
  maxScore: number;
  hint?: string;
}

export interface ApplicantField {
  label: string;
  type: FieldType;
  value: string;
  fileType?: FileType;
}

export interface Applicant {
  id: string;
  name: string;
  submittedAt: string;
  fields: ApplicantField[];
}

export interface Program {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  mode: EvaluationMode;
  criteria: Criterion[];
  judges: string[];
  applicants: Applicant[];
}

export interface Evaluation {
  programId: string;
  applicantId: string;
  judgeName: string;
  mode: EvaluationMode;
  decision?: TriageDecision;
  scores?: Record<string, number>;
  totalScore?: number;
  notes: string;
  submittedAt: string;
}

export interface AuthUser {
  name: string;
  role: "admin" | "judge";
}
