// ExecutionGraph builder and validator for agentics-execution-engine
import type { ExecutionSpan, ExecutionGraph } from '../types.js';

export interface GraphValidationResult {
  valid: boolean;
  failure_reasons: string[];
}

export function buildExecutionGraph(
  rootSpanId: string,
  spans: ExecutionSpan[]
): ExecutionGraph {
  return { root_span_id: rootSpanId, spans };
}

/**
 * Validates spans returned by a single delegation call.
 * Mandate 3: Each delegation MUST create a repo-level span,
 * require agent-level spans, and fail if spans are missing.
 * Throws on invalid delegation spans.
 */
export function validateDelegationSpans(
  spans: ExecutionSpan[],
  expectedRepoName: string
): void {
  const repoSpans = spans.filter(
    (s) => s.type === 'repo' && s.repo_name === expectedRepoName
  );
  if (repoSpans.length === 0) {
    throw new Error(
      `Delegation to '${expectedRepoName}' produced no repo-level span`
    );
  }

  for (const repoSpan of repoSpans) {
    const agentChildren = spans.filter(
      (s) => s.type === 'agent' && s.parent_span_id === repoSpan.span_id
    );
    if (agentChildren.length === 0) {
      throw new Error(
        `Delegation to '${expectedRepoName}' failed: ` +
        `repo span '${repoSpan.span_id}' lacks required agent-level spans`
      );
    }
  }
}

export function validateExecutionGraph(
  graph: ExecutionGraph
): GraphValidationResult {
  const reasons: string[] = [];

  // Core span must exist at root
  const coreSpan = graph.spans.find(
    (s) => s.span_id === graph.root_span_id
  );
  if (!coreSpan || coreSpan.type !== 'core') {
    reasons.push('Missing or invalid core span at root');
  }

  // At least one repo-level child span must exist
  const repoSpans = graph.spans.filter((s) => s.type === 'repo');
  if (repoSpans.length === 0) {
    reasons.push('No repo-level child spans exist');
  }

  // Every repo span must have at least one agent-level child
  for (const repoSpan of repoSpans) {
    const agentChildren = graph.spans.filter(
      (s) => s.type === 'agent' && s.parent_span_id === repoSpan.span_id
    );
    if (agentChildren.length === 0) {
      reasons.push(
        `Repo span '${repoSpan.name}' (${repoSpan.span_id}) lacks agent-level child spans`
      );
    }
  }

  // Verify all non-root spans have valid parent references
  for (const span of graph.spans) {
    if (span.span_id === graph.root_span_id) continue;
    if (!span.parent_span_id) {
      reasons.push(
        `Span '${span.name}' (${span.span_id}) has no parent_span_id`
      );
      continue;
    }
    const parent = graph.spans.find(
      (s) => s.span_id === span.parent_span_id
    );
    if (!parent) {
      reasons.push(
        `Span '${span.name}' references non-existent parent ${span.parent_span_id}`
      );
    }
  }

  return { valid: reasons.length === 0, failure_reasons: reasons };
}
