import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const STORAGE_KEY = "hr-leave-chat-v1";
const AUTH_KEY = "hr-auth-token";

const SUGGESTIONS = [
  {
    title: "Annual Leave",
    question: "How much annual leave do I get?",
    icon: "🏖️",
  },
  {
    title: "Sick Leave",
    question: "When do I need a medical certificate?",
    icon: "🤒",
  },
  {
    title: "Parental Leave",
    question: "How long is paid parental leave?",
    icon: "👨‍👩‍👧",
  },
  {
    title: "Unpaid Leave",
    question: "How do I apply for unpaid leave?",
    icon: "📄",
  },
];

function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as UIMessage[]) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function textOf(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join("");
}

function getPolicyMatch(message: UIMessage): number | null {
  const metadata = message.metadata as
    | { confidence?: number }
    | undefined;

  if (
    typeof metadata?.confidence !== "number" ||
    Number.isNaN(metadata.confidence)
  ) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(metadata.confidence)));
}

function getMatchLabel(match: number) {
  if (match >= 70) return "High policy match";
  if (match >= 50) return "Moderate policy match";
  return "Low policy match";
}

function getMatchDescription(match: number) {
  if (match >= 70) {
    return "The answer is strongly supported by the available policy.";
  }

  if (match >= 50) {
    return "Some relevant policy information was found.";
  }

  return "This may require confirmation from HR Operations.";
}

function getInitials(email: string) {
  const name = email.split("@")[0] ?? "U";

  const parts = name
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

type AuthUser = {
  email: string;
  role: string;
  region: string;
};

function loadAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;

  try {
    const token = window.localStorage.getItem(AUTH_KEY);

    if (!token) return null;

    const parts = token.split(".");

    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      decodeURIComponent(
        Array.from(
          atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
        )
          .map(
            (character) =>
              `%${`00${character.charCodeAt(0).toString(16)}`.slice(-2)}`,
          )
          .join(""),
      ),
    ) as {
      email?: string;
      role?: string;
      region?: string;
    };

    if (
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.region !== "string"
    ) {
      return null;
    }

    return {
      email: payload.email,
      role: payload.role,
      region: payload.region,
    };
  } catch {
    return null;
  }
}

function getSourceReferences(text: string) {
  const matches = text.match(/\[[A-Z]{2,5}-[\d.]+\]/g);

  if (!matches) return [];

  return Array.from(new Set(matches));
}

export function HrChat() {
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    sendMessage,
    status,
    error,
    setMessages,
  } = useChat({
    id: "hr-leave-chat",
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: () => {
        const token = window.localStorage.getItem(AUTH_KEY);

        return token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {};
      },
    }),
  });

  useEffect(() => {
    const saved = loadMessages();

    if (saved.length > 0) {
      setMessages(saved);
    }

    setAuthUser(loadAuthUser());
    setHydrated(true);
  }, [setMessages]);

  useEffect(() => {
    if (!hydrated) return;

    if (status === "ready" || status === "error") {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(messages),
        );
      } catch {
        /* storage unavailable */
      }
    }
  }, [messages, status, hydrated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, status]);

  useEffect(() => {
    if (status !== "streaming") {
      textareaRef.current?.focus();
    }
  }, [status]);

  const busy =
    status === "submitted" ||
    status === "streaming";

  const latestAssistantMessage = useMemo(() => {
    return [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" &&
          textOf(message).trim().length > 0,
      );
  }, [messages]);

  const latestPolicyMatch = latestAssistantMessage
    ? getPolicyMatch(latestAssistantMessage)
    : null;

  const submit = (value: string) => {
    const text = value.trim();

    if (!text || busy) return;

    setInput("");

    void sendMessage({
      text,
    });
  };

  const reset = () => {
    setMessages([]);

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }

    textareaRef.current?.focus();
  };

  const displayName =
    authUser?.email
      ?.split("@")[0]
      ?.replace(/[._-]+/g, " ")
      ?.replace(/\b\w/g, (letter) => letter.toUpperCase()) ||
    "Employee";

  const initials = authUser
    ? getInitials(authUser.email)
    : "U";

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        {/* Header */}
        <header className="flex items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-soft sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground shadow-sm">
              L
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-bold sm:text-lg">
                  Leavy
                </h1>

                <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary sm:inline-flex">
                  HR Assistant
                </span>
              </div>

              <p className="truncate text-xs text-muted-foreground">
                Your company policy assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {authUser && (
              <div className="hidden items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 sm:flex">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  {initials}
                </div>

                <div className="leading-tight">
                  <p className="max-w-28 truncate text-xs font-semibold">
                    {displayName}
                  </p>

                  <p className="text-[10px] capitalize text-muted-foreground">
                    {authUser.role} · {authUser.region}
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              New chat
            </button>
          </div>
        </header>

        {/* Main workspace */}
        <main className="mt-4 flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[1fr_260px] lg:gap-4">
          {/* Chat */}
          <section className="flex min-h-[620px] min-w-0 flex-1 flex-col rounded-2xl border border-border/70 bg-card shadow-soft lg:min-h-0">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {messages.length === 0 ? (
                <div className="flex min-h-full flex-col items-center justify-center py-10 text-center">
                  <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
                    ✦
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Welcome to Leavy
                    </p>

                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                      How can I help?
                    </h2>

                    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                      Ask about leave entitlements, policies, forms,
                      notice periods, approvals, and other HR
                      policy questions.
                    </p>
                  </div>

                  <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion.title}
                        type="button"
                        onClick={() =>
                          submit(suggestion.question)
                        }
                        className="group flex items-start gap-3 rounded-2xl border border-border bg-background p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-sm"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-base transition-colors group-hover:bg-primary/10">
                          {suggestion.icon}
                        </span>

                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">
                            {suggestion.title}
                          </span>

                          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                            {suggestion.question}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
                  {messages.map((message) => {
                    const messageText = textOf(message);
                    const policyMatch =
                      message.role === "assistant"
                        ? getPolicyMatch(message)
                        : null;

                    const sources =
                      message.role === "assistant"
                        ? getSourceReferences(messageText)
                        : [];

                    return (
                      <div
                        key={message.id}
                        className={
                          message.role === "user"
                            ? "flex justify-end"
                            : "flex justify-start"
                        }
                      >
                        <div
                          className={
                            message.role === "user"
                              ? "max-w-[88%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground shadow-sm"
                              : "w-full max-w-[92%]"
                          }
                        >
                          {message.role === "user" ? (
                            messageText
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                                  L
                                </div>

                                <div>
                                  <p className="text-xs font-semibold">
                                    Leavy
                                  </p>

                                  <p className="text-[10px] text-muted-foreground">
                                    HR Policy Assistant
                                  </p>
                                </div>
                              </div>

                              <div className="prose-sm max-w-none leading-7 text-foreground [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold">
                                <ReactMarkdown>
                                  {messageText}
                                </ReactMarkdown>
                              </div>

                              {policyMatch !== null &&
                                status !== "streaming" && (
                                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <p className="text-xs font-semibold">
                                          Policy Match
                                        </p>

                                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                                          {getMatchDescription(
                                            policyMatch,
                                          )}
                                        </p>
                                      </div>

                                      <div className="shrink-0 text-right">
                                        <p className="text-sm font-bold">
                                          {policyMatch}%
                                        </p>

                                        <p className="text-[10px] font-medium text-muted-foreground">
                                          {getMatchLabel(
                                            policyMatch,
                                          )}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                                      <div
                                        className="h-full rounded-full bg-primary transition-all duration-500"
                                        style={{
                                          width: `${policyMatch}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}

                              {sources.length > 0 &&
                                status !== "streaming" && (
                                  <div className="rounded-xl border border-border/70 bg-background p-3">
                                    <div className="mb-2 flex items-center gap-2">
                                      <span className="text-sm">
                                        📄
                                      </span>

                                      <p className="text-xs font-semibold">
                                        Policy source
                                      </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      {sources.map((source) => (
                                        <span
                                          key={source}
                                          className="rounded-lg bg-muted px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground"
                                        >
                                          {source}
                                        </span>
                                      ))}
                                    </div>

                                    <p className="mt-2 text-[10px] text-muted-foreground">
                                      Answer based on your company
                                      HR policy.
                                    </p>
                                  </div>
                                )}

                              {policyMatch !== null &&
                                policyMatch < 50 &&
                                status !== "streaming" && (
                                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                                    <div className="flex gap-3">
                                      <span className="text-base">
                                        ⚠️
                                      </span>

                                      <div>
                                        <p className="text-xs font-semibold">
                                          HR confirmation recommended
                                        </p>

                                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                          This question may not be
                                          fully covered by the
                                          available policy. For a
                                          case-specific answer,
                                          contact HR Operations.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {status === "submitted" && (
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                        L
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-current" />
                      </div>

                      <span className="text-xs">
                        Checking company policy…
                      </span>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                      Something went wrong. Please try
                      sending your question again.
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-border/70 p-3 sm:p-4">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submit(input);
                }}
                className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-background p-2 shadow-sm transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) =>
                    setInput(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      submit(input);
                    }
                  }}
                  rows={1}
                  placeholder="Ask about leave, policies, forms…"
                  className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                  aria-label="Ask Leavy a question"
                />

                <button
                  type="submit"
                  disabled={
                    busy || input.trim().length === 0
                  }
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? "..." : "Send"}
                </button>
              </form>

              <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-muted-foreground sm:text-xs">
                Leavy provides policy guidance. Contact HR Operations
                for case-specific questions.
              </p>
            </div>
          </section>

          {/* Desktop information panel */}
          <aside className="mt-4 hidden space-y-4 lg:mt-0 lg:block">
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-sm">
                  ✦
                </span>

                <div>
                  <h2 className="text-sm font-semibold">
                    How Leavy works
                  </h2>

                  <p className="text-[10px] text-muted-foreground">
                    Safe, policy-based answers
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {[
                  ["01", "Authenticate", "Verify your account"],
                  ["02", "Find policy", "Search HR knowledge"],
                  ["03", "Check match", "Measure policy relevance"],
                  ["04", "Answer safely", "Cite or escalate"],
                ].map(([number, title, description]) => (
                  <div
                    key={number}
                    className="flex gap-3"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[9px] font-bold text-muted-foreground">
                      {number}
                    </span>

                    <div>
                      <p className="text-xs font-semibold">
                        {title}
                      </p>

                      <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-sm">
                  🔐
                </span>

                <div>
                  <h2 className="text-sm font-semibold">
                    Your session
                  </h2>

                  <p className="text-[10px] text-muted-foreground">
                    Authenticated access
                  </p>
                </div>
              </div>

              {authUser ? (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-muted-foreground">
                      Role
                    </span>

                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold capitalize text-primary">
                      {authUser.role}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-muted-foreground">
                      Region
                    </span>

                    <span className="text-[10px] font-medium">
                      {authUser.region}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  Your authenticated session is active.
                </p>
              )}
            </div>

            {latestPolicyMatch !== null && (
              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Latest policy match
                </p>

                <div className="mt-2 flex items-end justify-between">
                  <span className="text-3xl font-bold">
                    {latestPolicyMatch}%
                  </span>

                  <span className="mb-1 text-[10px] font-medium text-muted-foreground">
                    {getMatchLabel(
                      latestPolicyMatch,
                    )}
                  </span>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{
                      width: `${latestPolicyMatch}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}