import React, { createContext, useContext } from "react";

import { useBoseScanner, BoseSpeaker } from "../hooks/useBoseScanner";

interface BoseContextType {
  speakers: BoseSpeaker[];
  isScanning: boolean;
  error: string | null;
  rescan: () => void;
  togglePower: (deviceID: string) => Promise<void>;
  changeVolume: (deviceID: string, vol: number) => Promise<void>;
  playPause: (deviceID: string) => Promise<void>;
  triggerKey: (deviceID: string, key: string) => Promise<void>;
  selectSource: (
    deviceID: string,
    source: string,
    sourceAccount?: string,
  ) => Promise<void>;
  refreshStatus: (speaker: BoseSpeaker) => Promise<void>;
  loadPresets: (deviceID: string) => Promise<void>;
  loadBass: (deviceID: string) => Promise<void>;
  savePreset: (deviceID: string, presetId: number) => Promise<void>;
  setBass: (deviceID: string, value: number) => Promise<void>;
  playStream: (deviceID: string, uri: string, name: string) => Promise<void>;
}

const BoseContext = createContext<BoseContextType | null>(null);

export const BoseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const scanner = useBoseScanner();

  return (
    <BoseContext.Provider value={scanner}>{children}</BoseContext.Provider>
  );
};

export const useBose = () => {
  const context = useContext(BoseContext);
  if (!context) {
    throw new Error("useBose must be used within a BoseProvider");
  }
  return context;
};
