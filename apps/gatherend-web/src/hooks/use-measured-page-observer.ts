"use client";

import { useCallback, useEffect, useRef } from "react";

export function useMeasuredPageObserver(
  onMeasure: (pageIndex: number, element: HTMLElement) => void,
) {
  const observerRef = useRef<ResizeObserver | null>(null);
  const elementsByPageRef = useRef(new Map<number, HTMLElement>());
  const pageIndexByElementRef = useRef(new WeakMap<HTMLElement, number>());

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        const pageIndex = pageIndexByElementRef.current.get(element);
        if (pageIndex === undefined) continue;
        onMeasure(pageIndex, element);
      }
    });

    observerRef.current = observer;
    elementsByPageRef.current.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      observerRef.current = null;
      elementsByPageRef.current.clear();
      pageIndexByElementRef.current = new WeakMap<HTMLElement, number>();
    };
  }, [onMeasure]);

  return useCallback(
    (pageIndex: number) => (element: HTMLElement | null) => {
      const previousElement = elementsByPageRef.current.get(pageIndex);

      if (previousElement && previousElement !== element) {
        observerRef.current?.unobserve(previousElement);
        elementsByPageRef.current.delete(pageIndex);
      }

      if (!element) {
        return;
      }

      elementsByPageRef.current.set(pageIndex, element);
      pageIndexByElementRef.current.set(element, pageIndex);
      onMeasure(pageIndex, element);
      observerRef.current?.observe(element);
    },
    [onMeasure],
  );
}
