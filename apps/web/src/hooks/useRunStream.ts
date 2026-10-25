import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreateRunRequest, RunResult, RunUsage, Source } from '@officepilot/shared';
import { ApiRequestError, api, toReadableError, type RunDetail } from '../api/client';

export type RunStatus = 'idle' | 'running' | 'done' | 'error';

export type TimelineEntry = {
  id: string;
  node: string;
  status: string;
  ms?: number;
  detail?: string;
  at: number;
};

export type ValidationEntry = {
  ok: boolean;
  errors: Array<{ field: string; reason: string }>;
  attempt: number;
};

export type RunError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type RunStreamState = {
  status: RunStatus;
  runId?: string;
  tokens: string;
  sources: Source[];
  timeline: TimelineEntry[];
  result: RunResult | null;
  error: RunError | null;
  validations: ValidationEntry[];
  usage: RunUsage | null;
};

type NodePayload = { node: string; status: string; ms?: number; detail?: string };
type TokenPayload = { text: string };
type CitationPayload = { sources: Source[] };
type DonePayload = { runId: string; usage: RunUsage };

function initialState(): RunStreamState {
  return {
    status: 'idle',
    runId: undefined,
    tokens: '',
    sources: [],
    timeline: [],
    result: null,
    error: null,
    validations: [],
    usage: null,
  };
}

function parseData<T>(event: Event): T | null {
  const data = (event as MessageEvent<string>).data;
  if (typeof data !== 'string' || !data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export function useRunStream() {
  const [state, setState] = useState<RunStreamState>(initialState);

  const sourceRef = useRef<EventSource | null>(null);
  const runIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const nodeIdRef = useRef(0);
  const retryTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearTimers = useCallback(() => {
    for (const timer of retryTimersRef.current) clearTimeout(timer);
    retryTimersRef.current = [];
  }, []);

  const closeSource = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const applyRunDetail = useCallback((detail: RunDetail) => {
    setState((prev) => {
      if (prev.runId && prev.runId !== detail.id) return prev;
      const resultSources = detail.result?.sources ?? [];
      const failed = detail.status === 'failed';
      const succeeded = detail.status === 'succeeded';
      return {
        ...prev,
        runId: detail.id,
        status: failed ? 'error' : succeeded ? 'done' : prev.status,
        result: detail.result ?? prev.result,
        sources: prev.sources.length ? prev.sources : resultSources,
        timeline: detail.timeline?.length
          ? detail.timeline.map((node, index) => ({
              id: `${detail.id}-${index}`,
              node: node.node,
              status: node.status,
              ms: node.ms,
              detail: node.detail,
              at: Date.now(),
            }))
          : prev.timeline,
        error: failed
          ? {
              code: detail.errorCode ?? 'RUN_FAILED',
              message: detail.errorMessage ?? '运行失败，请稍后重试',
              retryable: false,
            }
          : prev.error,
        usage: detail.usage ?? prev.usage,
      };
    });
  }, []);

  const reconcile = useCallback(
    async (runId: string): Promise<'done' | 'running' | 'error' | 'stale'> => {
      if (!mountedRef.current || runIdRef.current !== runId) return 'stale';
      try {
        const { run } = await api.getRun(runId);
        if (!mountedRef.current || runIdRef.current !== runId) return 'stale';
        if (run.status === 'succeeded' || run.status === 'failed') {
          applyRunDetail(run);
          closeSource();
          return 'done';
        }
        return 'running';
      } catch {
        return 'error';
      }
    },
    [applyRunDetail, closeSource],
  );

  const reconcileWithRetry = useCallback(
    (runId: string, attempt: number) => {
      void reconcile(runId).then((outcome) => {
        if (outcome === 'done' || outcome === 'stale') return;
        // The run is still alive — let EventSource reconnect and keep polling
        // the run record in the meantime.
        if (outcome === 'running') {
          if (attempt < 3) {
            const timer = setTimeout(
              () => reconcileWithRetry(runId, attempt + 1),
              700 * attempt,
            );
            retryTimersRef.current.push(timer);
          }
          return;
        }
        if (attempt < 3) {
          const timer = setTimeout(() => reconcileWithRetry(runId, attempt + 1), 700 * attempt);
          retryTimersRef.current.push(timer);
          return;
        }
        if (!mountedRef.current || runIdRef.current !== runId) return;
        setState((prev) =>
          prev.status === 'running'
            ? {
                ...prev,
                status: 'error',
                error: {
                  code: 'NETWORK',
                  message: '与服务器的连接中断，请检查后端服务后重试',
                  retryable: true,
                },
              }
            : prev,
        );
        closeSource();
      });
    },
    [reconcile, closeSource],
  );

  const start = useCallback(
    async (request: CreateRunRequest) => {
      clearTimers();
      closeSource();
      const generation = ++generationRef.current;
      runIdRef.current = null;
      nodeIdRef.current = 0;
      setState({ ...initialState(), status: 'running' });

      let created: { runId: string; status: string };
      try {
        created = await api.createRun(request);
      } catch (error) {
        if (!mountedRef.current || generation !== generationRef.current) return;
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: {
            code: error instanceof ApiRequestError ? error.code : 'INTERNAL',
            message: toReadableError(error),
            retryable: error instanceof ApiRequestError ? error.retryable : false,
          },
        }));
        return;
      }

      if (!mountedRef.current || generation !== generationRef.current) return;
      runIdRef.current = created.runId;
      setState((prev) => ({ ...prev, runId: created.runId }));

      const source = new EventSource(`/api/runs/${encodeURIComponent(created.runId)}/events`);
      sourceRef.current = source;

      source.addEventListener('node', (event) => {
        const payload = parseData<NodePayload>(event);
        if (!payload) return;
        const entry: TimelineEntry = {
          id: `node-${++nodeIdRef.current}`,
          node: payload.node,
          status: payload.status,
          ms: payload.ms,
          detail: payload.detail,
          at: Date.now(),
        };
        setState((prev) => ({ ...prev, timeline: [...prev.timeline, entry] }));
      });

      source.addEventListener('token', (event) => {
        const payload = parseData<TokenPayload>(event);
        if (!payload) return;
        setState((prev) => ({ ...prev, tokens: prev.tokens + payload.text }));
      });

      source.addEventListener('citation', (event) => {
        const payload = parseData<CitationPayload>(event);
        if (!payload) return;
        setState((prev) => ({ ...prev, sources: payload.sources }));
      });

      source.addEventListener('validation', (event) => {
        const payload = parseData<ValidationEntry>(event);
        if (!payload) return;
        setState((prev) => ({ ...prev, validations: [...prev.validations, payload] }));
      });

      // The server sends the RunResult itself for `result`, not a wrapper.
      source.addEventListener('result', (event) => {
        const result = parseData<RunResult>(event);
        if (!result) return;
        setState((prev) => ({
          ...prev,
          result,
          sources: prev.sources.length ? prev.sources : result.sources,
        }));
      });

      source.addEventListener('done', (event) => {
        const payload = parseData<DonePayload>(event);
        closeSource();
        setState((prev) => ({
          ...prev,
          status: prev.error ? 'error' : 'done',
          usage: payload?.usage ?? prev.usage,
        }));
      });

      // Catches both server-sent `error` events (MessageEvent with data) and
      // EventSource transport failures (plain Event, no data).
      source.addEventListener('error', (event) => {
        const payload = parseData<RunError>(event);
        if (payload) {
          setState((prev) => ({ ...prev, status: 'error', error: payload }));
          return;
        }
        const runId = runIdRef.current;
        if (runId) reconcileWithRetry(runId, 1);
      });
    },
    [clearTimers, closeSource, reconcileWithRetry],
  );

  const reset = useCallback(() => {
    generationRef.current += 1;
    clearTimers();
    closeSource();
    runIdRef.current = null;
    nodeIdRef.current = 0;
    setState(initialState());
  }, [clearTimers, closeSource]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      clearTimers();
      closeSource();
    };
  }, [clearTimers, closeSource]);

  return { state, start, reset };
}
