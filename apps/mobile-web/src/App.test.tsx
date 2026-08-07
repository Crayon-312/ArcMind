import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

const authState = vi.hoisted(() => ({ authenticated: false }));
const apiMocks = vi.hoisted(() => ({
  cancelResponse: vi.fn(),
  conversation: vi.fn(),
  sendTurn: vi.fn(),
}));

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(() => authState.authenticated
        ? Promise.resolve({
            id: "00000000-0000-4000-8000-000000000001",
            status: "active" as const,
            locale: "zh-CN",
            time_zone: "Asia/Shanghai",
            created_at: "2026-08-07T00:00:00Z",
          })
        : Promise.reject(new actual.ApiError(401))),
      logout: vi.fn(async () => {
        authState.authenticated = false;
      }),
      cancelResponse: apiMocks.cancelResponse,
      conversation: apiMocks.conversation,
      sendTurn: apiMocks.sendTurn,
    },
  };
});

vi.mock("./visual/ParticleCore", () => ({
  ParticleCore: () => <div data-testid="particle-core" />,
}));

class FakeEventSource {
  static latest: FakeEventSource | null = null;
  readonly listeners = new Map<string, (event: MessageEvent<string>) => void>();
  onerror: (() => void) | null = null;

  constructor(url: string, options: EventSourceInit) {
    void url;
    void options;
    FakeEventSource.latest = this;
  }

  addEventListener(name: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.set(name, listener as (event: MessageEvent<string>) => void);
  }

  close() {}

  emit(name: string, payload: Record<string, unknown> = {}) {
    this.listeners.get(name)?.(
      new MessageEvent("message", {
        data: JSON.stringify({
          event_id: crypto.randomUUID(),
          event_type: name,
          response_id: "00000000-0000-4000-8000-000000000020",
          sequence: 1,
          occurred_at: "2026-08-07T00:00:00Z",
          payload,
        }),
      }),
    );
  }
}

describe("App", () => {
  afterEach(cleanup);

  beforeEach(() => {
    authState.authenticated = false;
    sessionStorage.clear();
    FakeEventSource.latest = null;
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal("EventSource", FakeEventSource);
    apiMocks.conversation.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000010",
      mode: "text",
      state: "active",
      created_at: "2026-08-07T00:00:00Z",
      version: 1,
      turns: [],
    });
    apiMocks.sendTurn.mockResolvedValue({
      response_id: "00000000-0000-4000-8000-000000000020",
      event_stream_url: "/api/v1/responses/00000000-0000-4000-8000-000000000020/events",
    });
    apiMocks.cancelResponse.mockResolvedValue({
      response_id: "00000000-0000-4000-8000-000000000020",
      state: "cancelled",
      version: 2,
    });
  });

  it("shows the email identity entry when there is no session", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "欢迎回来" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送验证码" })).toBeEnabled();
  });

  it("returns to the email identity entry after logout", async () => {
    authState.authenticated = true;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "退出登录" }));

    expect(await screen.findByRole("heading", { name: "欢迎回来" })).toBeInTheDocument();
  });

  it("applies deltas, replaces with snapshots, and can cancel generation", async () => {
    authState.authenticated = true;
    sessionStorage.setItem(
      "arcmind-conversation",
      "00000000-0000-4000-8000-000000000010",
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );

    const input = await screen.findByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "测试流式回复" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(FakeEventSource.latest).not.toBeNull());
    act(() => {
      FakeEventSource.latest?.emit("response.started");
      FakeEventSource.latest?.emit("response.delta", { text: "第一段" });
      FakeEventSource.latest?.emit("response.delta", { text: "第二段" });
    });
    expect(await screen.findByText("第一段第二段")).toBeInTheDocument();

    act(() => {
      FakeEventSource.latest?.emit("response.snapshot", {
        text: "权威快照",
        snapshot_version: 1,
      });
    });
    expect(await screen.findByText("权威快照")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "停止生成" }));
    await waitFor(() =>
      expect(apiMocks.cancelResponse).toHaveBeenCalledWith(
        "00000000-0000-4000-8000-000000000020",
      ),
    );
    act(() => {
      FakeEventSource.latest?.emit("response.cancelled", {
        cancelled_by: "user",
        response_version: 2,
      });
    });
    expect(await screen.findByRole("button", { name: "发送" })).toBeInTheDocument();
  });
});
