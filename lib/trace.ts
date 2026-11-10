export type TraceEvent = {
  type: "trace";
  requestId: string;
  sequence: number;
  elapsedMs: number;
  stage: "request" | "classifier" | "model" | "tool" | "screening" | "citations";
  status: "started" | "completed" | "failed" | "skipped";
  title: string;
  detail: Record<string, unknown>;
  durationMs?: number;
};
export type TraceInput = Pick<TraceEvent, "stage" | "status" | "title" | "detail" | "durationMs">;
