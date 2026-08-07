import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, LoaderCircle, LogOut, Send, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { api, ApiError, type ConversationDetail, type ResponseEvent } from "./api";

function LoadingScreen() {
  return (
    <main className="app-shell centered" aria-label="正在加载">
      <LoaderCircle className="spin" size={24} aria-hidden="true" />
    </main>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const requestChallenge = useMutation({
    mutationFn: () => api.requestChallenge(email),
    onSuccess: (result) => {
      setChallengeId(result.challenge_id);
      setError(null);
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : "请求失败。"),
  });
  const verifyChallenge = useMutation({
    mutationFn: () => api.verifyChallenge(challengeId ?? "", code),
    onSuccess: onAuthenticated,
    onError: (reason) => setError(reason instanceof Error ? reason.message : "验证失败。"),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (challengeId) {
      verifyChallenge.mutate();
    } else {
      requestChallenge.mutate();
    }
  };

  return (
    <main className="auth-layout">
      <section className="identity-panel" aria-labelledby="auth-title">
        <div className="brand-row">
          <div className="brand-mark">A</div>
          <div>
            <strong>ArcMind</strong>
            <span>测试运行时</span>
          </div>
        </div>
        <div className="auth-copy">
          <ShieldCheck size={30} aria-hidden="true" />
          <h1 id="auth-title">{challengeId ? "输入验证码" : "验证你的邮箱"}</h1>
          <p>
            {challengeId
              ? "验证码已进入内部测试邮箱。"
              : "首个版本仅允许部署时配置的邮箱登录。"}
          </p>
        </div>
        <form onSubmit={submit} className="auth-form">
          {challengeId ? (
            <label>
              <span>六位验证码</span>
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                required
              />
            </label>
          ) : (
            <label>
              <span>邮箱</span>
              <input
                autoComplete="email"
                inputMode="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
          )}
          {error && <p className="error-text" role="alert">{error}</p>}
          <button
            className="primary-button"
            disabled={requestChallenge.isPending || verifyChallenge.isPending}
            type="submit"
          >
            {requestChallenge.isPending || verifyChallenge.isPending ? (
              <LoaderCircle className="spin" size={18} aria-hidden="true" />
            ) : challengeId ? (
              <Check size={18} aria-hidden="true" />
            ) : (
              <ArrowRight size={18} aria-hidden="true" />
            )}
            {challengeId ? "验证并进入" : "发送验证码"}
          </button>
          {challengeId && (
            <button className="text-button" type="button" onClick={() => setChallengeId(null)}>
              更换邮箱
            </button>
          )}
        </form>
      </section>
    </main>
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
          <p>{streaming}</p>
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

  const conversation = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => api.conversation(conversationId ?? ""),
    enabled: Boolean(conversationId),
  });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: onLoggedOut,
  });

  const listen = (eventUrl: string, activeConversationId: string) => {
    setIsResponding(true);
    const source = new EventSource(eventUrl, { withCredentials: true });
    source.addEventListener("response.snapshot", (rawEvent) => {
      const event = JSON.parse((rawEvent as MessageEvent<string>).data) as ResponseEvent;
      setStreaming(String(event.payload.text ?? ""));
    });
    source.addEventListener("response.completed", () => {
      source.close();
      setStreaming("");
      setIsResponding(false);
      void queryClient.invalidateQueries({ queryKey: ["conversation", activeConversationId] });
    });
    source.onerror = () => {
      source.close();
      setIsResponding(false);
      setError("事件连接中断，请刷新后查看最终结果。");
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
      await queryClient.invalidateQueries({ queryKey: ["conversation", activeId] });
      listen(accepted.event_stream_url, activeId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "发送失败，请重试。");
    }
  };

  return (
    <main className="chat-layout">
      <header className="topbar">
        <div className="brand-row compact">
          <div className="brand-mark">A</div>
          <div><strong>ArcMind</strong><span>文字闭环</span></div>
        </div>
        <div className="topbar-actions">
          <span className="runtime-status"><i />测试模型</span>
          <button className="icon-button" onClick={() => logout.mutate()} title="退出登录">
            <LogOut size={19} aria-hidden="true" />
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
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="send-button" disabled={!draft.trim() || isResponding} title="发送">
            {isResponding ? (
              <LoaderCircle className="spin" size={20} aria-hidden="true" />
            ) : (
              <Send size={20} aria-hidden="true" />
            )}
            <span className="sr-only">发送</span>
          </button>
        </form>
      </footer>
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
