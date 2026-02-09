// Tests for execution graph instrumentation
// Validates hierarchical span structure, enforcement semantics, and output contract
import { createAutomationCore } from '../src/lib.js';
import { validateExecutionGraph } from '../src/execution/graph.js';
import type { ExecutionSpan, CoreExecutionResult } from '../src/types.js';

describe('Execution Graph Instrumentation', () => {
  const service = createAutomationCore();

  let result: CoreExecutionResult;

  beforeAll(async () => {
    result = await service.execute({
      pipelineId: 'test-pipeline',
      input: { prompt: 'test' },
      routingHints: { modelTier: 'balanced' },
    });
  });

  it('should return a valid execution graph', () => {
    expect(result.execution_graph).toBeDefined();
    expect(result.execution_graph.root_span_id).toBeDefined();
    expect(result.execution_graph.spans).toBeInstanceOf(Array);
  });

  it('should have a core span at the root', () => {
    const coreSpan = result.execution_graph.spans.find(
      (s) => s.span_id === result.execution_graph.root_span_id
    );
    expect(coreSpan).toBeDefined();
    expect(coreSpan!.type).toBe('core');
    expect(coreSpan!.name).toBe('automation-core');
    expect(coreSpan!.status).toBe('completed');
    expect(coreSpan!.start_time).toBeDefined();
    expect(coreSpan!.end_time).toBeDefined();
  });

  it('should have exactly 4 repo-level child spans', () => {
    const repoSpans = result.execution_graph.spans.filter(
      (s) => s.type === 'repo'
    );
    expect(repoSpans).toHaveLength(4);

    const repoNames = repoSpans.map((s) => s.repo_name).sort();
    expect(repoNames).toEqual([
      'llm-auto-optimizer',
      'llm-connector-hub',
      'llm-forge',
      'llm-orchestrator',
    ]);
  });

  it('should have repo spans parented to core span', () => {
    const repoSpans = result.execution_graph.spans.filter(
      (s) => s.type === 'repo'
    );
    for (const span of repoSpans) {
      expect(span.parent_span_id).toBe(result.execution_graph.root_span_id);
    }
  });

  it('should have at least one agent span per repo span', () => {
    const repoSpans = result.execution_graph.spans.filter(
      (s) => s.type === 'repo'
    );
    for (const repoSpan of repoSpans) {
      const agentChildren = result.execution_graph.spans.filter(
        (s) => s.type === 'agent' && s.parent_span_id === repoSpan.span_id
      );
      expect(agentChildren.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should have exactly 4 agent-level spans', () => {
    const agentSpans = result.execution_graph.spans.filter(
      (s) => s.type === 'agent'
    );
    expect(agentSpans).toHaveLength(4);
  });

  it('should have total span count of 9 (1 core + 4 repo + 4 agent)', () => {
    expect(result.execution_graph.spans).toHaveLength(9);
  });

  it('should preserve correct hierarchy: Core > Repo > Agent', () => {
    const { spans, root_span_id } = result.execution_graph;

    // Core at root
    const coreSpan = spans.find((s) => s.span_id === root_span_id)!;
    expect(coreSpan.type).toBe('core');
    expect(coreSpan.parent_span_id).toBeNull();

    // Repos under core
    const repoSpans = spans.filter((s) => s.type === 'repo');
    for (const repo of repoSpans) {
      expect(repo.parent_span_id).toBe(coreSpan.span_id);
    }

    // Agents under repos
    const agentSpans = spans.filter((s) => s.type === 'agent');
    for (const agent of agentSpans) {
      const parent = spans.find((s) => s.span_id === agent.parent_span_id);
      expect(parent).toBeDefined();
      expect(parent!.type).toBe('repo');
    }
  });

  it('should have all spans completed', () => {
    for (const span of result.execution_graph.spans) {
      expect(span.status).toBe('completed');
      expect(span.end_time).toBeDefined();
    }
  });

  it('should have unique span IDs', () => {
    const ids = result.execution_graph.spans.map((s) => s.span_id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have ISO 8601 timestamps', () => {
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    for (const span of result.execution_graph.spans) {
      expect(span.start_time).toMatch(isoRegex);
      if (span.end_time) {
        expect(span.end_time).toMatch(isoRegex);
      }
    }
  });

  it('should be JSON-serializable without loss of structure', () => {
    const serialized = JSON.stringify(result.execution_graph);
    const deserialized = JSON.parse(serialized);
    expect(deserialized.root_span_id).toBe(result.execution_graph.root_span_id);
    expect(deserialized.spans).toHaveLength(result.execution_graph.spans.length);
    for (let i = 0; i < deserialized.spans.length; i++) {
      expect(deserialized.spans[i].span_id).toBe(
        result.execution_graph.spans[i].span_id
      );
      expect(deserialized.spans[i].type).toBe(
        result.execution_graph.spans[i].type
      );
      expect(deserialized.spans[i].parent_span_id).toBe(
        result.execution_graph.spans[i].parent_span_id
      );
    }
  });

  it('should pass graph validation', () => {
    const validation = validateExecutionGraph(result.execution_graph);
    expect(validation.valid).toBe(true);
    expect(validation.failure_reasons).toHaveLength(0);
  });
});

describe('Execution Graph Artifacts & Evidence', () => {
  it('should attach artifacts at agent level', async () => {
    const service = createAutomationCore();
    const result = await service.execute({
      pipelineId: 'artifact-test',
      input: {},
    });

    const agentSpans = result.execution_graph.spans.filter(
      (s) => s.type === 'agent'
    );
    const withArtifacts = agentSpans.filter(
      (s) => s.artifacts && s.artifacts.length > 0
    );
    expect(withArtifacts.length).toBeGreaterThan(0);

    for (const span of withArtifacts) {
      for (const artifact of span.artifacts!) {
        expect(artifact.id).toBeDefined();
        expect(artifact.type).toBeDefined();
        expect(artifact.reference).toBeDefined();
      }
    }
  });

  it('should attach evidence at agent level with machine-verifiable references', async () => {
    const service = createAutomationCore();
    const result = await service.execute({ input: {} });

    const agentSpans = result.execution_graph.spans.filter(
      (s) => s.type === 'agent'
    );
    const withEvidence = agentSpans.filter(
      (s) => s.evidence && s.evidence.length > 0
    );
    expect(withEvidence.length).toBeGreaterThan(0);

    for (const span of withEvidence) {
      for (const ev of span.evidence!) {
        expect(ev.id).toBeDefined();
        expect(ev.type).toBeDefined();
        expect(ev.uri).toBeDefined();
        expect(ev.uri).toMatch(/^(provider|workflow):\/\//);
      }
    }
  });
});

describe('Execution Graph with parentSpanId', () => {
  it('should set core span parent_span_id from options', async () => {
    const service = createAutomationCore();
    const engineSpanId = 'engine-span-abc-123';

    const result = await service.execute({
      input: {},
      options: { parentSpanId: engineSpanId },
    });

    const coreSpan = result.execution_graph.spans.find(
      (s) => s.span_id === result.execution_graph.root_span_id
    );
    expect(coreSpan!.parent_span_id).toBe(engineSpanId);
  });

  it('should set core span parent_span_id to null when not provided', async () => {
    const service = createAutomationCore();
    const result = await service.execute({ input: {} });

    const coreSpan = result.execution_graph.spans.find(
      (s) => s.span_id === result.execution_graph.root_span_id
    );
    expect(coreSpan!.parent_span_id).toBeNull();
  });
});

describe('Execution Graph Validation', () => {
  it('should detect missing core span', () => {
    const result = validateExecutionGraph({
      root_span_id: 'nonexistent',
      spans: [],
    });
    expect(result.valid).toBe(false);
    expect(result.failure_reasons).toContain(
      'Missing or invalid core span at root'
    );
  });

  it('should detect missing repo spans', () => {
    const coreSpan: ExecutionSpan = {
      type: 'core',
      name: 'test-core',
      span_id: 'core-1',
      parent_span_id: null,
      start_time: new Date().toISOString(),
      status: 'completed',
    };
    const result = validateExecutionGraph({
      root_span_id: 'core-1',
      spans: [coreSpan],
    });
    expect(result.valid).toBe(false);
    expect(result.failure_reasons).toContain('No repo-level child spans exist');
  });

  it('should detect repo spans lacking agent children', () => {
    const coreSpan: ExecutionSpan = {
      type: 'core',
      name: 'test-core',
      span_id: 'core-1',
      parent_span_id: null,
      start_time: new Date().toISOString(),
      status: 'completed',
    };
    const repoSpan: ExecutionSpan = {
      type: 'repo',
      name: 'test-repo',
      span_id: 'repo-1',
      parent_span_id: 'core-1',
      start_time: new Date().toISOString(),
      status: 'completed',
    };
    const result = validateExecutionGraph({
      root_span_id: 'core-1',
      spans: [coreSpan, repoSpan],
    });
    expect(result.valid).toBe(false);
    expect(result.failure_reasons).toContainEqual(
      expect.stringContaining('lacks agent-level child spans')
    );
  });

  it('should detect orphan spans with invalid parent references', () => {
    const coreSpan: ExecutionSpan = {
      type: 'core',
      name: 'test-core',
      span_id: 'core-1',
      parent_span_id: null,
      start_time: new Date().toISOString(),
      status: 'completed',
    };
    const repoSpan: ExecutionSpan = {
      type: 'repo',
      name: 'test-repo',
      span_id: 'repo-1',
      parent_span_id: 'core-1',
      start_time: new Date().toISOString(),
      status: 'completed',
    };
    const agentSpan: ExecutionSpan = {
      type: 'agent',
      name: 'test-agent',
      span_id: 'agent-1',
      parent_span_id: 'nonexistent-parent',
      start_time: new Date().toISOString(),
      status: 'completed',
    };
    const result = validateExecutionGraph({
      root_span_id: 'core-1',
      spans: [coreSpan, repoSpan, agentSpan],
    });
    expect(result.valid).toBe(false);
    expect(result.failure_reasons).toContainEqual(
      expect.stringContaining('references non-existent parent')
    );
  });

  it('should accept a valid graph', () => {
    const coreSpan: ExecutionSpan = {
      type: 'core',
      name: 'test-core',
      span_id: 'core-1',
      parent_span_id: null,
      start_time: new Date().toISOString(),
      status: 'completed',
    };
    const repoSpan: ExecutionSpan = {
      type: 'repo',
      name: 'test-repo',
      span_id: 'repo-1',
      parent_span_id: 'core-1',
      start_time: new Date().toISOString(),
      status: 'completed',
    };
    const agentSpan: ExecutionSpan = {
      type: 'agent',
      name: 'test-agent',
      span_id: 'agent-1',
      parent_span_id: 'repo-1',
      start_time: new Date().toISOString(),
      status: 'completed',
    };
    const result = validateExecutionGraph({
      root_span_id: 'core-1',
      spans: [coreSpan, repoSpan, agentSpan],
    });
    expect(result.valid).toBe(true);
    expect(result.failure_reasons).toHaveLength(0);
  });
});

describe('Execution Graph Failure Semantics', () => {
  it('should return execution graph on success', async () => {
    const service = createAutomationCore();
    const result = await service.execute({ input: {} });
    expect(result.success).toBe(true);
    expect(result.execution_graph).toBeDefined();
    expect(result.execution_graph.spans.length).toBe(9);
  });

  it('should always return execution graph even when graph is empty', () => {
    // Direct validation of an empty graph
    const result = validateExecutionGraph({
      root_span_id: 'missing',
      spans: [],
    });
    expect(result.valid).toBe(false);
    expect(result.failure_reasons.length).toBeGreaterThan(0);
  });
});
