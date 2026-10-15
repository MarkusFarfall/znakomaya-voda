"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export function rememberFailure(error: unknown) {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  console.error("[startup/recovery]", error);
  try { sessionStorage.setItem("zv_last_failure", JSON.stringify({ at: new Date().toISOString(), message: message.slice(0, 3000) })); } catch { /* storage may be unavailable */ }
  return message.split("\n")[0];
}

export function RecoveryScreen({ message }: { message?: string }) {
  return <main data-zv-ready="true" style={{ minHeight: "100dvh", background: "#07131b", color: "#eee7d7", padding: "max(24px, env(safe-area-inset-top)) 24px", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif" }}>
    <section style={{ maxWidth: 460 }}>
      <p style={{ color: "#bfa777", letterSpacing: ".16em", fontSize: 12 }}>ЗНАКОМАЯ ВОДА</p>
      <h1 style={{ fontSize: 30, lineHeight: 1.15, margin: "20px 0" }}>Не удалось продолжить запуск</h1>
      <p style={{ lineHeight: 1.7 }}>Не очищайте данные сайта. Эта ошибка не запускает новую игру и не удаляет сохранение.</p>
      <a href="/recover.html" style={{ display: "block", margin: "24px 0", padding: 16, background: "#d5bd89", color: "#091722", borderRadius: 8, textAlign: "center", fontWeight: 600 }}>Открыть восстановление запуска</a>
      <p style={{ fontSize: 13, lineHeight: 1.6, opacity: .7 }}>Можно скачать локальную копию прогресса, обновить файлы игры или включить безопасную графику.</p>
      {message && <details style={{ marginTop: 24, overflowWrap: "anywhere", fontSize: 12 }}><summary>Технические сведения</summary><pre style={{ whiteSpace: "pre-wrap" }}>{message}</pre></details>}
    </section>
  </main>;
}

export class GameBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  componentDidCatch(error: Error, info: ErrorInfo) { rememberFailure(`${error.stack ?? error.message}\n${info.componentStack ?? ""}`); }
  render() { return this.state.error !== null ? <RecoveryScreen message={this.state.error} /> : this.props.children; }
}
