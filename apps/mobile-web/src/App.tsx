import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, LoaderCircle, LogOut, Send, ShieldCheck, Square } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { api, ApiError, type ConversationDetail, type ResponseEvent } from "./api";

import { ParticleCore } from "./visual/ParticleCore";
import { deriveCoreMode, type CoreMode, type VisualSignal } from "./visual/state";

function LoadingScreen() {
  return (
    <main className="app-shell centered" aria-label="正在加载">
      <LoaderCircle className="spin" size={24} aria-hidden="true" />
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
    <>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}>
        <ParticleCore mode="idle" signal={{ audio: { level: 0, low: 0, mid: 0, high: 0, rhythm: 0 }, tokenPulse: 0, errorPulse: 0, thinkingLevel: 0, speakingLevel: 0 }} />
      </div>
      <main className="auth-layout">
        <section className="identity-panel" aria-labelledby="auth-title">
          <div className="brand-row">
            <div className="brand-mark">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <div>
              <strong>ArcMind</strong>
              <span>测试运行时</span>
            </div>
          </div>
          <div className="auth-copy">
            <h1 id="auth-title">欢迎回来</h1>
            <p>请输入账号和密码登录。</p>
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
            <button
              className="primary-button"
              disabled={login.isPending}
              type="submit"
            >
              {login.isPending ? (
                <LoaderCircle className="spin" size={18} aria-hidden="true" />
              ) : (
                <ArrowRight size={18} aria-hidden="true" />
              )}
              {login.isPending ? "正在登录" : "登录"}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}

function MessageList({ conversation, streaming }: {
  conversation?: ConversationDetail;
  streaming: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.turns.length, streaming]);

  if (!conversation?.turns.length && !streaming) {
    return (
      <div className="empty-state">
        <h2>开始一段文字对话</h2>
        <p>当前由确定性测试模型响应。</p>
      </div>
    );
  }

  return (
    <div className="message-list" aria-live="polite">
      {conversation?.turns.map((turn) => (
        <article className={`message ${turn.role}`} key={turn.id}>
          <span>{turn.role === "user" ? "你" : "ArcMind"}</span>
          <p>{turn.content}</p>
        </article>
      ))}
      {streaming && (
        <article className="message assistant pending">
          <span>ArcMind</span>
          <p>
            {streaming}
            <span className="typing-indicator">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          </p>
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
  const eventSourceRef = useRef<EventSource | null>(null);

  const [coreMode, setCoreMode] = useState<CoreMode>("idle");
  const [signal, setSignal] = useState<VisualSignal>({
    audio: { level: 0, low: 0, mid: 0, high: 0, rhythm: 0 },
    tokenPulse: 0,
    errorPulse: 0,
    thinkingLevel: 0,
    speakingLevel: 0,
  });

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
    onError: (reason) =>
      setError(reason instanceof Error ? reason.message : "停止失败，请重试。"),
  });

  useEffect(() => () => eventSourceRef.current?.close(), []);

  useEffect(() => {
    // 简单地基于状态衍生核心的视觉模式
    setCoreMode(deriveCoreMode({
      conversationStatus: isResponding ? "streaming" : "idle",
      microphoneStatus: "idle",
      muted: false,
      lastMessage: conversation.data?.turns && conversation.data.turns.length > 0
        ? { role: conversation.data.turns[conversation.data.turns.length - 1]!.role as "user" | "assistant" | "system" }
        : null
    }));
  }, [isResponding, conversation.data?.turns]);

  useEffect(() => {
    // 模拟的音频与思考信号
    let timer: number;
    const tick = () => {
      setSignal(prev => {
        const next = { ...prev };
        if (coreMode === "speaking") {
          next.speakingLevel = 1;
          next.thinkingLevel = 0;
          next.audio = {
            level: 0.2 + Math.random() * 0.4,
            low: 0.1 + Math.random() * 0.3,
            mid: 0.3 + Math.random() * 0.5,
            high: 0.2 + Math.random() * 0.4,
            rhythm: Math.random() * 0.5
          };
        } else if (coreMode === "thinking") {
          next.speakingLevel = 0;
          next.thinkingLevel = 1;
          next.audio = { level: 0, low: 0, mid: 0, high: 0, rhythm: 0 };
          if (Math.random() > 0.8) next.tokenPulse = Date.now();
        } else {
          next.speakingLevel = 0;
          next.thinkingLevel = 0;
          next.audio = { level: 0, low: 0, mid: 0, high: 0, rhythm: 0 };
        }
        return next;
      });
      timer = window.setTimeout(tick, 100);
    };
    tick();
    return () => clearTimeout(timer);
  }, [coreMode]);

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
    const source = new EventSource(eventUrl, { withCredentials: true });
    eventSourceRef.current = source;
    source.addEventListener("response.started", () => setError(null));
    source.addEventListener("response.delta", (rawEvent) => {
      const event = JSON.parse((rawEvent as MessageEvent<string>).data) as ResponseEvent;
      setStreaming((current) => current + String(event.payload.text ?? ""));
      setError(null);
    });
    source.addEventListener("response.snapshot", (rawEvent) => {
      const event = JSON.parse((rawEvent as MessageEvent<string>).data) as ResponseEvent;
      setStreaming(String(event.payload.text ?? ""));
      setError(null);
    });
    source.addEventListener("response.completed", () => {
      finishListening(activeConversationId);
    });
    source.addEventListener("response.cancelled", () => {
      finishListening(activeConversationId);
    });
    source.addEventListener("response.failed", (rawEvent) => {
      const event = JSON.parse((rawEvent as MessageEvent<string>).data) as ResponseEvent;
      finishListening(activeConversationId);
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
      setError(reason instanceof Error ? reason.message : "发送失败，请重试。");
    }
  };

  return (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}>
        <ParticleCore mode={coreMode} signal={signal} />
      </div>
      <main className="chat-layout">
        <header className="topbar">
          <div className="brand-row compact">
            <div className="brand-mark">
              <ShieldCheck size={18} aria-hidden="true" />
            </div>
            <div><strong>ArcMind</strong><span>文字闭环</span></div>
          </div>
          <div className="topbar-actions">
            <span className="runtime-status"><i />测试模型</span>
            <button className="icon-button" onClick={() => logout.mutate()} title="退出登录">
              <LogOut size={18} aria-hidden="true" />
              <span className="sr-only">退出登录</span>
            </button>
          </div>
        </header>
        <MessageList conversation={conversation.data} streaming={streaming} />
        <footer className="composer-wrap">
          {error && <p className="error-text" role="alert">{error}</p>}
          <form className="composer" onSubmit={send}>
            <textarea
              aria-label="输入消息"
              maxLength={20_000}
              placeholder="输入消息"
              rows={1}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                event.target.style.height = 'auto';
                event.target.style.height = Math.min(event.target.scrollHeight, 140) + 'px';
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            {isResponding && responseId ? (
              <button
                className="send-button"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(responseId)}
                title="停止生成"
                type="button"
              >
                {cancel.isPending ? (
                  <LoaderCircle className="spin" size={20} aria-hidden="true" />
                ) : (
                  <Square size={18} aria-hidden="true" />
                )}
                <span className="sr-only">停止生成</span>
              </button>
            ) : (
              <button className="send-button" disabled={!draft.trim()} title="发送">
                <Send size={18} aria-hidden="true" />
                <span className="sr-only">发送</span>
              </button>
            )}
          </form>
        </footer>
      </main>
    </>
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
    return <AuthScreen onAuthenticated={() => void queryClient.invalidateQueries({ queryKey: ["me"] })} />;
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
