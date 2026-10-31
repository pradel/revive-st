import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  useSpeakerManager,
  type BoseSpeaker,
} from "../hooks/useSpeakerManager";
import { useLocalNetworkIntro } from "../lib/local-network";

export type { BoseSpeaker };

type BoseContextType = ReturnType<typeof useSpeakerManager>;

const BoseContext = createContext<BoseContextType | null>(null);

export function BoseProvider({ children }: { children: ReactNode }) {
  // On iOS the first scan triggers the Local Network prompt, so it waits for
  // the screen explaining it.
  const manager = useSpeakerManager({
    enabled: useLocalNetworkIntro() === "done",
  });

  // We memoize the manager to avoid unnecessary re-renders.
  // Note: manager itself contains functions that are stable or state that changes,
  // so passing the whole object directly is fine, but we wrap it in useMemo
  // to ensure object identity changes only when necessary if useSpeakerManager returns a new object.
  const contextValue = useMemo(() => manager, [manager]);

  return (
    <BoseContext.Provider value={contextValue}>{children}</BoseContext.Provider>
  );
}

export const useBose = () => {
  const context = useContext(BoseContext);
  if (!context) {
    throw new Error("useBose must be used within a BoseProvider");
  }
  return context;
};
