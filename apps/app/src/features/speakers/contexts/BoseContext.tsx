import React, { createContext, useContext, useMemo } from "react";

import {
  useSpeakerManager,
  type BoseSpeaker,
} from "../hooks/useSpeakerManager";

export type { BoseSpeaker };

type BoseContextType = ReturnType<typeof useSpeakerManager>;

const BoseContext = createContext<BoseContextType | null>(null);

export const BoseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const manager = useSpeakerManager();

  // We memoize the manager to avoid unnecessary re-renders.
  // Note: manager itself contains functions that are stable or state that changes,
  // so passing the whole object directly is fine, but we wrap it in useMemo
  // to ensure object identity changes only when necessary if useSpeakerManager returns a new object.
  const contextValue = useMemo(() => manager, [manager]);

  return (
    <BoseContext.Provider value={contextValue}>{children}</BoseContext.Provider>
  );
};

export const useBose = () => {
  const context = useContext(BoseContext);
  if (!context) {
    throw new Error("useBose must be used within a BoseProvider");
  }
  return context;
};
