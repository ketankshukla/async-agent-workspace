export type RunStatus = "queued" | "running" | "completed" | "failed";

export type StepType = "plan" | "tool_call" | "tool_result" | "final" | "error";

export interface Run {
  id: string;
  task: string;
  status: RunStatus;
  final_answer: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunStep {
  id: string;
  run_id: string;
  idx: number;
  type: StepType;
  title: string;
  detail: string | null;
  created_at: string;
}
