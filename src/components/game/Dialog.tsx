"use client";

import { Children, cloneElement, isValidElement, useEffect, useId, useRef, type ReactElement, type ReactNode } from "react";
import { Icon } from "./Icons";
import "./game-ui.css";

const stack: HTMLElement[] = [];
const focusable = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]';

/** Game-only dialogs: contain keyboard focus, dismiss only the top layer, restore the opener. */
export function useGameDialog(onClose?: () => void, active = true) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const previous = document.activeElement as HTMLElement | null;
    stack.push(node);
    const controls = () => [...node.querySelectorAll<HTMLElement>(focusable)].filter(el => el.getClientRects().length && el.tabIndex >= 0);
    const frame = requestAnimationFrame(() => {
      if (stack.at(-1) === node) (node.querySelector<HTMLElement>('[data-dialog-focus]') ?? node).focus({ preventScroll: true });
    });
    const onKey = (event: KeyboardEvent) => {
      if (stack.at(-1) !== node) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close.current?.();
      } else if (event.key === "Tab") {
        const items = controls();
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (!items.length || index < 0 || (!event.shiftKey && index === items.length - 1) || (event.shiftKey && index === 0)) {
          event.preventDefault();
          (items[event.shiftKey ? items.length - 1 : 0] ?? node).focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey, true);
      const wasTop = stack.at(-1) === node;
      const index = stack.indexOf(node);
      if (index !== -1) stack.splice(index, 1);
      if (wasTop && previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active]);
  return ref;
}

type TabProps = { className?: string; role?: string; id?: string; tabIndex?: number; "aria-selected"?: boolean; "aria-controls"?: string };

export function GameDialog({ label, title, onClose, children, tabs, right, wide = true, above = false, className, overlayClassName }: {
  label?: string; title: string; onClose: () => void; children: ReactNode; tabs?: ReactNode; right?: ReactNode; wide?: boolean; above?: boolean; className?: string; overlayClassName?: string;
}) {
  const ref = useGameDialog(onClose);
  const id = useId();
  const scroll = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLDivElement>(null);
  const entries = Children.toArray(tabs).filter(isValidElement) as ReactElement<TabProps>[];
  const selected = entries.findIndex(tab => tab.props.className?.split(/\s+/).includes("on"));
  const activeKey = entries[selected]?.key ?? "page";
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
    nav.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeKey]);
  return (
    <div className={`zv-ui game-dialog-overlay ${above ? "game-dialog-above" : ""} ${overlayClassName ?? ""}`} onPointerDown={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} data-game-dialog tabIndex={-1} className={`sheet game-dialog ${wide ? "game-dialog-wide" : ""} ${className ?? ""}`}>
        <header className="game-dialog-header">
          <div className="min-w-0">
            {label && <div className="label-brass game-dialog-eyebrow">{label}</div>}
            <h2 id={`${id}-title`} className="game-dialog-title">{title}</h2>
          </div>
          {right && <div className="game-dialog-meta">{right}</div>}
          <button onClick={onClose} data-dialog-focus className="iconbtn game-dialog-close" aria-label="Закрыть"><Icon name="close" size={18} /></button>
        </header>
        {tabs ? (
          <div ref={nav} role="tablist" aria-label={title} className="game-dialog-tabs zv-scroll-x" onKeyDown={e => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
            const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (current < 0) return;
            e.preventDefault(); e.stopPropagation();
            const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (current + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next]?.focus(); buttons[next]?.click();
          }}>
            {entries.map((tab, index) => cloneElement(tab, { role: "tab", id: `${id}-tab-${index}`, "aria-selected": index === selected, "aria-controls": `${id}-panel`, tabIndex: index === selected ? 0 : -1 }))}
          </div>
        ) : <div className="game-dialog-rule" />}
        <div ref={scroll} id={`${id}-panel`} role={tabs ? "tabpanel" : undefined} aria-labelledby={tabs && selected >= 0 ? `${id}-tab-${selected}` : undefined} className="game-dialog-scroll">
          <div key={activeKey} className="game-dialog-page">{children}</div>
        </div>
      </div>
    </div>
  );
}
