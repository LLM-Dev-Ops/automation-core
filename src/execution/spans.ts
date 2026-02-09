// Execution span creation utilities for agentics-execution-engine
import { randomUUID } from 'node:crypto';
import type { ExecutionSpan, SpanArtifact, SpanEvidence } from '../types.js';

export function generateSpanId(): string {
  return randomUUID();
}

export function createSpan(opts: {
  type: ExecutionSpan['type'];
  name: string;
  parent_span_id: string | null;
  span_id?: string;
  repo_name?: string;
}): ExecutionSpan {
  return {
    type: opts.type,
    name: opts.name,
    span_id: opts.span_id ?? generateSpanId(),
    parent_span_id: opts.parent_span_id,
    start_time: new Date().toISOString(),
    status: 'running',
    ...(opts.repo_name && { repo_name: opts.repo_name }),
  };
}

export function completeSpan(span: ExecutionSpan, opts?: {
  status?: 'completed' | 'failed';
  artifacts?: SpanArtifact[];
  evidence?: SpanEvidence[];
}): ExecutionSpan {
  return {
    ...span,
    end_time: new Date().toISOString(),
    status: opts?.status ?? 'completed',
    ...(opts?.artifacts && { artifacts: opts.artifacts }),
    ...(opts?.evidence && { evidence: opts.evidence }),
  };
}
