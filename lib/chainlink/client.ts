/**
 * Transport + low-level endpoints for the Chainlink Confidential AI Attester.
 *
 * Server-only — reads CHAINLINK_ATTESTER_API_KEY from the environment. Never
 * import this into client components.
 */

import {
  AttesterError,
  type InferenceRequest,
  type InferenceSnapshot,
  type InferenceStatus,
  type Model,
} from "./types";

const DEFAULT_BASE_URL = "https://confidential-ai-dev-preview.cldev.cloud";

function baseUrl(): string {
  return (process.env.CHAINLINK_ATTESTER_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/+$/,
    ""
  );
}

function apiKey(): string {
  const key = process.env.CHAINLINK_ATTESTER_API_KEY;
  if (!key) {
    throw new AttesterError(
      "CHAINLINK_ATTESTER_API_KEY is not configured",
      500,
      "missing_api_key"
    );
  }
  return key;
}

async function attesterFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${apiKey()}`,
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const code = (data as { error?: string }).error;
    const message =
      (data as { message?: string }).message ??
      code ??
      `Attester request failed (${res.status})`;
    throw new AttesterError(message, res.status, code);
  }

  return data as T;
}

/** GET /v1/models — list supported models. */
export async function listModels(): Promise<Model[]> {
  const data = await attesterFetch<{ models: Model[] }>("/v1/models");
  return data.models;
}

/** POST /v1/inference — submit a request, returns the initial 202 snapshot. */
export async function submitInference(
  body: InferenceRequest
): Promise<InferenceSnapshot> {
  return attesterFetch<InferenceSnapshot>("/v1/inference", {
    method: "POST",
    body,
  });
}

/** GET /v1/inference/:id — poll one request's current state. */
export async function getInference(id: string): Promise<InferenceSnapshot> {
  return attesterFetch<InferenceSnapshot>(
    `/v1/inference/${encodeURIComponent(id)}`
  );
}

const TERMINAL: InferenceStatus[] = ["completed", "failed"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PollOptions {
  /** Milliseconds between polls. Default 2000. */
  intervalMs?: number;
  /** Total milliseconds to wait before giving up. Default 300000 (5 min). */
  timeoutMs?: number;
  /** Called on every poll with the latest snapshot — useful for progress UI. */
  onUpdate?: (snapshot: InferenceSnapshot) => void;
}

/**
 * Submit an inference request and poll until it reaches a terminal state.
 * Inference is asynchronous, so per-resource problems surface here as
 * status "failed" rather than at submit time — always run to completion.
 */
export async function runInference(
  body: InferenceRequest,
  opts: PollOptions = {}
): Promise<InferenceSnapshot> {
  const intervalMs = opts.intervalMs ?? 2000;
  const timeoutMs = opts.timeoutMs ?? 300000;

  const submitted = await submitInference(body);
  opts.onUpdate?.(submitted);
  if (TERMINAL.includes(submitted.status)) return submitted;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const snapshot = await getInference(submitted.id);
    opts.onUpdate?.(snapshot);
    if (TERMINAL.includes(snapshot.status)) return snapshot;
  }

  throw new AttesterError(
    `Inference ${submitted.id} did not complete within ${timeoutMs}ms`,
    504,
    "poll_timeout"
  );
}
