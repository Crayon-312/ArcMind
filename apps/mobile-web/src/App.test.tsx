import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

const authState = vi.hoisted(() => ({ authenticated: false }));

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
    },
  };
});

describe("App", () => {
  beforeEach(() => {
    authState.authenticated = false;
    sessionStorage.clear();
  });

  it("shows the email identity entry when there is no session", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "验证你的邮箱" })).toBeInTheDocument();
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

    expect(await screen.findByRole("heading", { name: "验证你的邮箱" })).toBeInTheDocument();
  });
});
