import type { components } from "@arcmind/contracts";

export type CurrentUser = components["schemas"]["CurrentUser"];
export type Conversation = components["schemas"]["Conversation"];
export type ConversationDetail = components["schemas"]["ConversationDetail"];
export type ResponseAccepted = components["schemas"]["ResponseAccepted"];
export type ResponseEvent = {
  event_id: string;
  event_type: string;
  response_id: string;
  sequence: number;
  occurred_at: string;
  payload: Record<string, unknown>;
};

type ErrorEnvelope = components["schemas"]["ErrorEnvelope"];

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, envelope?: ErrorEnvelope) {
    super(envelope?.error.message ?? "请求失败，请稍后重试。");
    this.name = "ApiError";
    this.code = envelope?.error.code ?? "UNKNOWN_ERROR";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: "same-origin",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let envelope: ErrorEnvelope | undefined;
    try {
      envelope = (await response.json()) as ErrorEnvelope;
    } catch {
      envelope = undefined;
    }
    throw new ApiError(response.status, envelope);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  me: () => request<CurrentUser>("/me"),
  requestChallenge: (email: string) =>
    request<components["schemas"]["AuthChallengeAccepted"]>("/auth/challenges", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  verifyChallenge: (challengeId: string, code: string) =>
    request<CurrentUser>(`/auth/challenges/${challengeId}/verify`, {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  logout: () => request<void>("/auth/sessions/current", { method: "DELETE" }),
  createConversation: () =>
    request<Conversation>("/conversations", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ mode: "text" }),
    }),
  conversation: (conversationId: string) =>
    request<ConversationDetail>(`/conversations/${conversationId}`),
  sendTurn: (conversationId: string, content: string) =>
    request<ResponseAccepted>(`/conversations/${conversationId}/turns`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ content }),
    }),
  cancelResponse: (responseId: string) =>
    request<components["schemas"]["ResponseState"]>(`/responses/${responseId}/cancel`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({}),
    }),
};
