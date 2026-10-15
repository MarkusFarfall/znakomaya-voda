"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** One owned pointer/key, with cancellation distinct from intentional release. */
export function HoldControl({
  label,
  children,
  className = "",
  disabled = false,
  onPress,
  onRelease,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onPress: () => void;
  onRelease: (cancelled: boolean) => void;
}) {
  const owner = useRef<number | string | null>(null);
  const callbacks = useRef({ onPress, onRelease });
  const [held, setHeld] = useState(false);
  useEffect(() => {
    callbacks.current = { onPress, onRelease };
  }, [onPress, onRelease]);
  const release = useCallback((cancelled: boolean) => {
    if (owner.current === null) return;
    owner.current = null;
    setHeld(false);
    callbacks.current.onRelease(cancelled);
  }, []);
  useEffect(() => {
    if (disabled) release(true);
  }, [disabled, release]);
  useEffect(() => {
    const cancel = () => release(true),
      visibility = () => {
        if (document.hidden) cancel();
      };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", visibility);
      cancel();
    };
  }, [release]);
  const press = (id: number | string) => {
    if (disabled || owner.current !== null) return;
    owner.current = id;
    setHeld(true);
    callbacks.current.onPress();
  };
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={held}
      disabled={disabled}
      className={`${className} ${held ? "is-held" : ""}`}
      style={{ touchAction: "none" }}
      onPointerDown={(ev) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (owner.current !== null || disabled) return;
        ev.currentTarget.setPointerCapture(ev.pointerId);
        press(ev.pointerId);
      }}
      onPointerUp={(ev) => {
        if (owner.current !== ev.pointerId) return;
        ev.preventDefault();
        ev.stopPropagation();
        release(false);
        if (ev.currentTarget.hasPointerCapture(ev.pointerId))
          ev.currentTarget.releasePointerCapture(ev.pointerId);
      }}
      onPointerCancel={(ev) => {
        if (owner.current === ev.pointerId) release(true);
      }}
      onLostPointerCapture={(ev) => {
        if (owner.current === ev.pointerId) release(true);
      }}
      onKeyDown={(ev) => {
        if (ev.code === "Space" || ev.code === "Enter") {
          ev.preventDefault();
          ev.stopPropagation();
          if (!ev.repeat) press(ev.code);
        }
      }}
      onKeyUp={(ev) => {
        if (owner.current === ev.code) {
          ev.preventDefault();
          ev.stopPropagation();
          release(false);
        }
      }}
      onBlur={() => release(true)}
      onContextMenu={(ev) => ev.preventDefault()}
      onClick={(ev) => ev.preventDefault()}
    >
      {children}
    </button>
  );
}
