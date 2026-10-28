import { useEffect, useRef, useState } from "react";

export interface SliderDraft {
  /** Value to show: the drag in progress, else the remote value. */
  value: number;
  /** Every step of a drag (Compose `onValueChange`). */
  onValueChange: (value: number) => void;
  /** The drag finished (Compose `onValueChangeFinished`). */
  onSlidingComplete: () => void;
  /** Handlers for a SwiftUI slider, which reports drags as editing. */
  swiftUI: {
    onValueChange: (value: number) => void;
    onEditingChanged: (isEditing: boolean) => void;
  };
}

/**
 * Local draft of a remote value for a native slider. The draft follows
 * `value` when it changes underneath (e.g. the speaker reports a new volume),
 * except during a drag, and `onCommit` is called once when the drag ends.
 */
export function useSliderDraft(
  value: number,
  onCommit: (value: number) => void,
): SliderDraft {
  const [draft, setDraft] = useState(value);
  const [isSliding, setIsSliding] = useState(false);

  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    if (!isSliding) {
      setDraft(value);
    }
  }

  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  // Read in event handlers only: the latest step, until it's committed.
  const pendingRef = useRef<number | null>(null);
  const isEditingRef = useRef(false);

  const onValueChange = (next: number) => {
    // Native sliders can report their current value without a drag.
    if (next === draft && pendingRef.current === null) {
      return;
    }
    pendingRef.current = next;
    setDraft(next);
    setIsSliding(true);
  };

  const onSlidingComplete = () => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setIsSliding(false);
    if (pending !== null && pending !== value) {
      onCommitRef.current(pending);
    }
  };

  return {
    value: draft,
    onValueChange,
    onSlidingComplete,
    swiftUI: {
      onValueChange: (next) => {
        onValueChange(next);
        // VoiceOver adjustments change the value without an editing phase.
        if (!isEditingRef.current) {
          onSlidingComplete();
        }
      },
      onEditingChanged: (isEditing) => {
        isEditingRef.current = isEditing;
        if (!isEditing) {
          onSlidingComplete();
        }
      },
    },
  };
}
