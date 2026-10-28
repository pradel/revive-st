import { useEffect, useRef, useState } from "react";

/**
 * Local draft of a remote value, for sliders. The draft follows `value` when
 * it changes underneath (e.g. the speaker reports a new volume) and calls
 * `onCommit` once the draft has rested for `delayMs`, and on unmount if a
 * change is still pending, so a drag sends one request rather than one per
 * step.
 */
export function useDraftValue(
  value: number,
  onCommit: (value: number) => void,
  delayMs = 400,
): [number, (value: number) => void] {
  const [draft, setDraft] = useState(value);

  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setDraft(value);
  }

  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  const pendingRef = useRef<number | null>(null);
  useEffect(() => {
    if (draft === value) {
      pendingRef.current = null;
      return;
    }
    pendingRef.current = draft;
    const timer = setTimeout(() => {
      pendingRef.current = null;
      onCommitRef.current(draft);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [draft, value, delayMs]);

  useEffect(
    () => () => {
      if (pendingRef.current !== null) {
        onCommitRef.current(pendingRef.current);
      }
    },
    [],
  );

  return [draft, setDraft];
}
