import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  Send,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { api, ApiError, type ConversationDetail, type ResponseEvent } from "./api";
import { ParticleCore } from "./visual/ParticleCore";
import { EMPTY_AUDIO_SIGNAL, resolveVisualSignal } from "./visual/signal";
import { deriveCoreMode, type CoreMode, type VisualSignal } from "./visual/state";

const IDLE_VISUAL_SIGNAL: VisualSignal = {
  audio: EMPTY_AUDIO_SIGNAL,
  tokenPulse: 0,
  errorPulse: 0,
  thinkingLevel: 0,
  speakingLevel: 0,
};

function coreModeLabel(mode: CoreMode): string {
  const labels: Record<CoreMode, string> = {
    idle: "待机",
    ready: "就绪",
    connecting: "连接中",
    listening: "聆听",
    transcribing: "转写中",
    thinking: "思考中",
    speaking: "回应就绪",
    muted: "静音",
    connection_error: "连接异常",
    error: "异常",
  };
  return labels[mode];
}

function BrandAnchor() {
  return (
    <header className="brand-anchor">
      <span className="brand-anchor-icon" aria-hidden="true">
        <ShieldCheck size={17} />
      </span>
      <h1>ArcMind</h1>
    </header>
  );
}

function LoadingScreen() {
  return (
    <main className="app-shell loading-shell" aria-label="正在加载">
      <ParticleCore mode="idle" signal={IDLE_VISUAL_SIGNAL} />
      <div className="ambient-grid" />
      <section className="command-surface">
        <BrandAnchor />
        <div className="loading-indicator">
          <LoaderCircle size={22} aria-hidden="true" />
          <span>正在唤醒弦核</span>
        </div>
      </section>
    </main>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: () => api.login(username, password),
    onSuccess: () => {
      setPassword("");
      setError(null);
      onAuthenticated();
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : "登录失败。"),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate();
  };

  return (
    <main className="app-shell auth-shell">
      <ParticleCore mode={error ? "error" : "idle"} signal={IDLE_VISUAL_SIGNAL} />
      <div className="ambient-grid" />
      <section className="command-surface">
        <BrandAnchor />
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="panel-kicker">
            <span className="status-dot status-ready" />
            <span>PERSONAL RUNTIME</span>
          </div>
          <div className="auth-copy">
            <span>弦核身份验证</span>
            <h2 id="auth-title">欢迎回来</h2>
            <p>输入后台预置账号，进入 ArcMind 对话空间。</p>
          </div>
          <form onSubmit={submit} className="auth-form">
            <label>
              <span>账号</span>
              <input
                autoComplete="username"
                maxLength={64}
                minLength={3}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </label>
            <label>
              <span>密码</span>
              <input
                autoComplete="current-password"
                maxLength={128}
                minLength={8}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {error && <p className="error-text" role="alert">{error}</p>}
            <button className="auth-submit" disabled={login.isPending} type="submit">
              {login.isPending ? (
                <LoaderCircle className="spin" size={18} aria-hidden="true" />
              ) : (
                <ShieldCheck size={18} aria-hidden="true" />
              )}
              {login.isPending ? "正在登录" : "登录"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

function MessageList({
  conversation,
  streaming,
}: {
  conversation?: ConversationDetail;
  streaming: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [conversation?.turns.length, streaming]);

  if (!conversation?.turns.length && !streaming) {
    return (
      <div className="conversation-empty">
        <span>ARC CHANNEL</span>
        <strong>弦核已就绪</strong>
        <p>从下方输入区开始一段文字对话。</p>
      </div>
    );
  }

  return (
    <div className="legacy-message-list" aria-live="polite">
      {conversation?.turns.map((turn) => (
        <article className={`legacy-message ${turn.role}`} key={turn.id}>
          <span>{turn.role === "user" ? "YOU" : "ARCMIND"}</span>
          <p>{turn.content}</p>
        </article>
      ))}
      {streaming && (
        <article className="legacy-message assistant pending">
          <span>ARCMIND · STREAMING</span>
          <p>{streaming}</p>
          <i className="stream-caret" aria-hidden="true" />
        </article>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function ChatScreen({ onLoggedOut }: { onLoggedOut: () => void }) {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(() =>
    sessionStorage.getItem("arcmind-conversation"),
  );
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isResponding, setIsResponding] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [tokenPulse, setTokenPulse] = useState(0);
  const [errorPulse, setErrorPulse] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const composerFocusInsideRef = useRef(false);
  const lastVisualTokenPulseAtRef = useRef(0);

  const conversation = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => api.conversation(conversationId ?? ""),
    enabled: Boolean(conversationId),
  });

  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: onLoggedOut,
  });

  const cancel = useMutation({
    mutationFn: (activeResponseId: string) => api.cancelResponse(activeResponseId),
    onError: (reason) => {
      setErrorPulse((value) => value + 1);
      setError(reason instanceof Error ? reason.message : "停止失败，请重试。");
    },
  });

  const lastTurn = conversation.data?.turns.at(-1);
  const coreMode = useMemo<CoreMode>(() => {
    if (error && !isResponding) return "error";
    return deriveCoreMode({
      conversationStatus: isResponding ? "streaming" : "idle",
      microphoneStatus: "idle",
      muted: false,
      lastMessage: lastTurn
        ? { role: lastTurn.role as "user" | "assistant" | "system" }
        : null,
    });
  }, [error, isResponding, lastTurn]);

  const visualSignal = useMemo(
    () =>
      resolveVisualSignal({
        mode: coreMode,
        audio: EMPTY_AUDIO_SIGNAL,
        tokenPulse,
        errorPulse,
      }),
    [coreMode, errorPulse, tokenPulse],
  );

  useEffect(() => () => eventSourceRef.current?.close(), []);

  const pulseTokenVisual = () => {
    const now = Date.now();
    if (now - lastVisualTokenPulseAtRef.current < 140) return;
    lastVisualTokenPulseAtRef.current = now;
    setTokenPulse((value) => value + 1);
  };

  const finishListening = (activeConversationId: string) => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setStreaming("");
    setIsResponding(false);
    setResponseId(null);
    void queryClient.invalidateQueries({ queryKey: ["conversation", activeConversationId] });
  };

  const listen = (eventUrl: string, activeConversationId: string) => {
    eventSourceRef.current?.close();
    setIsResponding(true);
    setTranscriptOpen(true);
    const source = new EventSource(eventUrl, { withCredentials: true });
    eventSourceRef.current = source;

    source.addEventListener("response.started", () => setError(null));
    source.addEventListener("response.delta", (rawEvent) => {
      const event = JSON.parse((rawEvent as MessageEvent<string>).data) as ResponseEvent;
      setStreaming((current) => current + String(event.payload.text ?? ""));
      pulseTokenVisual();
      setError(null);
    });
    source.addEventListener("response.snapshot", (rawEvent) => {
      const event = JSON.parse((rawEvent as MessageEvent<string>).data) as ResponseEvent;
      setStreaming(String(event.payload.text ?? ""));
      pulseTokenVisual();
      setError(null);
    });
    source.addEventListener("response.completed", () => finishListening(activeConversationId));
    source.addEventListener("response.cancelled", () => finishListening(activeConversationId));
    source.addEventListener("response.failed", (rawEvent) => {
      const event = JSON.parse((rawEvent as MessageEvent<string>).data) as ResponseEvent;
      finishListening(activeConversationId);
      setErrorPulse((value) => value + 1);
      setError(`回复失败：${String(event.payload.error_code ?? "MODEL_UNAVAILABLE")}`);
    });
    source.onerror = () => {
      setError("事件连接中断，正在自动重连。");
    };
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isResponding) return;

    setError(null);
    setTokenPulse(0);
    lastVisualTokenPulseAtRef.current = 0;
    setTranscriptOpen(true);
    setComposerOpen(false);

    try {
      let activeId = conversationId;
      if (!activeId) {
        const created = await api.createConversation();
        activeId = created.id;
        setConversationId(activeId);
        sessionStorage.setItem("arcmind-conversation", activeId);
      }
      setDraft("");
      const accepted = await api.sendTurn(activeId, content);
      setResponseId(accepted.response_id);
      await queryClient.invalidateQueries({ queryKey: ["conversation", activeId] });
      listen(accepted.event_stream_url, activeId);
    } catch (reason) {
      setComposerOpen(true);
      setErrorPulse((value) => value + 1);
      setError(reason instanceof Error ? reason.message : "发送失败，请重试。");
    }
  };

  const composerVisible = composerOpen;

  return (
    <main
      className={`app-shell is-text-chat ${transcriptOpen ? "is-workbench-open" : ""} ${composerVisible ? "is-composer-open" : ""}`}
    >
      <ParticleCore
        mode={coreMode}
        signal={visualSignal}
        workbenchOpen={transcriptOpen}
        composerOpen={composerVisible}
      />
      <div className="ambient-grid" />

      <section className="command-surface" aria-label="ArcMind conversation">
        <BrandAnchor />

        <div className="runtime-actions">
          {isResponding && responseId && (
            <button
              className="tool-icon-button is-active"
              type="button"
              title="停止生成"
              aria-label="停止生成"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(responseId)}
            >
              {cancel.isPending ? (
                <LoaderCircle className="spin" size={16} aria-hidden="true" />
              ) : (
                <Square size={15} aria-hidden="true" />
              )}
            </button>
          )}
          <button
            className={`tool-icon-button ${transcriptOpen ? "is-active" : ""}`}
            type="button"
            title="对话记录"
            aria-label="对话记录"
            onClick={() => setTranscriptOpen((value) => !value)}
          >
            <MessageSquareText size={16} />
            <span className={`status-dot status-${coreMode}`} />
          </button>
          <button
            className="tool-icon-button"
            type="button"
            title="退出登录"
            aria-label="退出登录"
            onClick={() => logout.mutate()}
          >
            <LogOut size={16} />
          </button>
        </div>

        <section className="hero-stage" aria-label="ArcMind core status">
          <div className="core-readout">
            <span>弦核模式</span>
            <strong>{coreModeLabel(coreMode)}</strong>
          </div>
        </section>

        <section
          className={`dialogue-panel ${transcriptOpen ? "is-open" : ""}`}
          aria-label="对话记录"
          aria-hidden={!transcriptOpen}
        >
          <div className="workbench-header">
            <div>
              <span>CONVERSATION</span>
              <strong>文字闭环</strong>
            </div>
            <button
              className="icon-button"
              type="button"
              title="关闭对话记录"
              aria-label="关闭对话记录"
              onClick={() => setTranscriptOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <MessageList conversation={conversation.data} streaming={streaming} />
        </section>

        <div
          className="composer-zone"
          onPointerEnter={() => setComposerOpen(true)}
          onMouseEnter={() => setComposerOpen(true)}
        >
          <button
            className="composer-handle"
            type="button"
            title="输入"
            aria-label="展开输入框"
            onClick={() => setComposerOpen(true)}
          >
            <span />
          </button>
        </div>

        <div className={`composer-impact ${composerVisible ? "is-active" : ""}`} aria-hidden="true">
          <span className="impact-edge" />
          <span className="impact-spark impact-spark-a" />
          <span className="impact-spark impact-spark-b" />
          <span className="impact-spark impact-spark-c" />
        </div>

        <div className={`composer-source-ripple ${composerVisible ? "is-active" : ""}`} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <footer
          className={`composer is-text-only ${composerVisible ? "is-open" : ""}`}
          onPointerEnter={() => setComposerOpen(true)}
          onMouseEnter={() => setComposerOpen(true)}
          onPointerLeave={() => {
            if (!draft.trim() && !composerFocusInsideRef.current) setComposerOpen(false);
          }}
          onFocusCapture={() => {
            composerFocusInsideRef.current = true;
          }}
          onBlurCapture={(event) => {
            if (
              !event.relatedTarget ||
              !(event.relatedTarget instanceof Node) ||
              !event.currentTarget.contains(event.relatedTarget)
            ) {
              composerFocusInsideRef.current = false;
              if (!draft.trim()) setComposerOpen(false);
            }
          }}
        >
          {!isResponding && (
            <button
              className="composer-collapse-button"
              type="button"
              title="收起输入框"
              aria-label="收起输入框"
              onClick={() => setComposerOpen(false)}
            >
              <ChevronDown size={16} />
            </button>
          )}
          <form className="composer-form" onSubmit={send}>
            <input
              aria-label="输入消息"
              maxLength={20_000}
              placeholder="输入文字消息..."
              value={draft}
              disabled={isResponding}
              onChange={(event) => setDraft(event.target.value)}
            />
            {isResponding ? (
              <span className="composer-busy-indicator" aria-hidden="true">
                <Square size={14} />
              </span>
            ) : (
              <button
                className="icon-button send-button"
                disabled={!draft.trim()}
                title="发送"
                aria-label="发送"
                type="submit"
              >
                <Send size={18} aria-hidden="true" />
              </button>
            )}
          </form>
          {error && <p className="composer-error" role="alert">{error}</p>}
        </footer>
      </section>
    </main>
  );
}

export function App() {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: (count, reason) => !(reason instanceof ApiError && reason.status === 401) && count < 2,
  });

  if (me.isPending) return <LoadingScreen />;

  if (me.isError) {
    return (
      <AuthScreen
        onAuthenticated={() => void queryClient.invalidateQueries({ queryKey: ["me"] })}
      />
    );
  }

  return (
    <ChatScreen
      onLoggedOut={() => {
        sessionStorage.removeItem("arcmind-conversation");
        queryClient.removeQueries({ queryKey: ["conversation"] });
        void queryClient.resetQueries({ queryKey: ["me"] });
      }}
    />
  );
}
