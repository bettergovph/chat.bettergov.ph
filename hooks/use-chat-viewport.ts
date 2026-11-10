"use client";

import { useEffect, useRef } from "react";

type KeyboardGeometry = EventTarget & { boundingRect: DOMRectReadOnly };

/** Embedded browsers can resize/pan the visible viewport without changing dvh. */
export function useChatViewport() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const shell = ref.current;
    if (!shell) return;
    const viewport = window.visualViewport;
    const keyboard = (navigator as Navigator & { virtualKeyboard?: KeyboardGeometry }).virtualKeyboard;
    let frame = 0;
    let fullHeight = window.innerHeight;
    let width = window.innerWidth;
    let keyboardOpen = false;

    const measure = () => {
      frame = 0;
      // Pinch zoom also shrinks the visual viewport. Preserve its native pan and
      // zoom behavior instead of reflowing the app to the magnified rectangle.
      if (viewport && Math.abs(viewport.scale - 1) > 0.05) return;
      const top = Math.max(0, viewport?.offsetTop ?? 0);
      let height = viewport?.height ?? window.innerHeight;
      const bounds = keyboard?.boundingRect;
      // Some hosts overlay both viewports but expose keyboard geometry. Do not
      // opt into overlaysContent or override the host's normal resize behavior.
      if (bounds && bounds.height > 0 && bounds.width > 0 && bounds.top > top) height = Math.min(height, bounds.top - top);
      if (!Number.isFinite(height) || height <= 0) return;
      if (Math.abs(window.innerWidth - width) > 1) {
        width = window.innerWidth;
        fullHeight = window.innerHeight;
        keyboardOpen = false;
      }
      const focused = document.activeElement;
      const editing = focused instanceof HTMLElement && shell.contains(focused) && (focused.matches("textarea, input") || focused.isContentEditable);
      fullHeight = Math.max(fullHeight, window.innerHeight, height);
      keyboardOpen = fullHeight - height > 100 && (editing || keyboardOpen || Boolean(bounds?.height));
      if (!editing && !keyboardOpen) fullHeight = window.innerHeight;
      shell.style.setProperty("--chat-viewport-height", `${height}px`);
      shell.style.setProperty("--chat-viewport-top", `${top}px`);
      shell.dataset.keyboardOpen = String(keyboardOpen);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const listeners: [EventTarget, string][] = [
      [window, "resize"], [window, "orientationchange"], [window, "pageshow"],
      [document, "focusin"], [document, "focusout"],
    ];
    if (viewport) listeners.push([viewport, "resize"], [viewport, "scroll"]);
    if (keyboard) listeners.push([keyboard, "geometrychange"]);
    for (const [target, event] of listeners) target.addEventListener(event, schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      for (const [target, event] of listeners) target.removeEventListener(event, schedule);
      shell.style.removeProperty("--chat-viewport-height");
      shell.style.removeProperty("--chat-viewport-top");
      delete shell.dataset.keyboardOpen;
    };
  }, []);
  return ref;
}
