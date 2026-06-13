/**
 * Types mirroring the Chainlink Confidential AI Attester REST API.
 *
 * Docs: https://confidential-ai-dev-preview.cldev.cloud/docs
 */

export type ModelId = "gemma4" | "qwen3.6";

export interface Model {
  id: string;
  name: string;
  size: string;
  context: number;
  capabilities: string[];
  backend: string;
}

/** A resource the enclave fetches over HTTP(S) before inference. */
export interface UrlResource {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  encoding?: "text" | "hex";
  preprocess?: boolean;
}

/** A resource uploaded inline as base64. */
export interface FileResource {
  filename?: string;
  content_type?: string;
  content_base64: string;
  preprocess?: boolean;
}

export type Resource = UrlResource | FileResource;

export interface InferenceRequest {
  model: string;
  prompt: string;
  system_prompt?: string;
  resources?: Resource[];
  cre_callback?: { url: string };
}

export type InferenceStatus =
  | "queued"
  | "preparing-resources"
  | "processing"
  | "completed"
  | "failed";

export interface ResourceDigest {
  url?: string;
  digest?: string;
  request_digest?: string;
  response_digest?: string;
  content_type?: string;
  preprocessed?: boolean;
  filename_digest?: string;
  filename_blinding?: string;
}

/** The status snapshot returned by submit (202) and poll (200). */
export interface InferenceSnapshot {
  id: string;
  status: InferenceStatus;
  queue_position?: number;
  model: string;
  system_prompt?: string;
  prompt: string;
  resource_summaries?: Array<{
    filename?: string;
    url?: string;
    digest?: string;
    content_type?: string;
    size?: number;
    preprocessed?: boolean;
  }>;
  output?: string;
  error?: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
  resources?: ResourceDigest[];
  cre_callback?: {
    url: string;
    executed?: boolean;
    success?: boolean;
    status_code?: number;
    executed_at?: string;
  };
  created_at?: string;
  started_at?: string;
  status_at?: string;
  completed_at?: string;
}

/** Thrown when the attester returns a non-2xx response. */
export class AttesterError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AttesterError";
    this.status = status;
    this.code = code;
  }
}
