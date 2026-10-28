import { useEffect, useRef, useState } from "react";

/**
 * Local draft of a remote value, for sliders. The draft follows `value` when
 * it changes underneath (e.g. the speaker reports a new volume), except while
 * a change of the user's is still waiting to be sent. It calls `onCommit`
 * once the draft has rested for `delayMs`, and on unmount if a change is
 * still pending, so a drag sends one request rather than one per step.
 */
export function useDraftValue(
  value: number,
  onCommit: (value: number) => void,
  delayMs = 400,
): [number, (value: number) => void] {
  const [draft, setDraft] = useState(value);
  const [isPending, setIsPending] = useState(false);

  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    if (!isPending) {
      setDraft(value);
    }
  }

  const updateDraft = (next: number) => {
    // Native sliders can report their current value without a drag.
    if (next === draft) {
      return;
    }
    setDraft(next);
    setIsPending(true);
  };

  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  const pendingRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPending) {
      pendingRef.current = null;
      return;
    }
    pendingRef.current = draft;
    const timer = setTimeout(() => {
      pendingRef.current = null;
      setIsPending(false);
      onCommitRef.current(draft);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [draft, isPending, delayMs]);

  useEffect(
    () => () => {
      if (pendingRef.current !== null) {
        onCommitRef.current(pendingRef.current);
      }
    },
    [],
  );

  return [draft, updateDraft];
}
