import React, { createContext, useContext } from "react";

import { useBoseScanner, BoseSpeaker } from "../hooks/useBoseScanner";
import {
  useVolumeMutation,
  usePowerToggleMutation,
  usePlayPauseMutation,
  useKeyMutation,
  useSelectSourceMutation,
  useSetBassMutation,
  useSavePresetMutation,
  usePlayStreamMutation,
  useSetNameMutation,
  useSetAudioDspControlsMutation,
  useSetAudioProductToneControlsMutation,
  useSetAudioProductLevelControlsMutation,
} from "../hooks/useSpeakerMutations";

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
  volumeMutation: ReturnType<typeof useVolumeMutation>;
  powerToggleMutation: ReturnType<typeof usePowerToggleMutation>;
  playPauseMutation: ReturnType<typeof usePlayPauseMutation>;
  keyMutation: ReturnType<typeof useKeyMutation>;
  selectSourceMutation: ReturnType<typeof useSelectSourceMutation>;
  setBassMutation: ReturnType<typeof useSetBassMutation>;
  savePresetMutation: ReturnType<typeof useSavePresetMutation>;
  playStreamMutation: ReturnType<typeof usePlayStreamMutation>;
  setNameMutation: ReturnType<typeof useSetNameMutation>;
  setAudioDspControlsMutation: ReturnType<
    typeof useSetAudioDspControlsMutation
  >;
  setAudioProductToneControlsMutation: ReturnType<
    typeof useSetAudioProductToneControlsMutation
  >;
  setAudioProductLevelControlsMutation: ReturnType<
    typeof useSetAudioProductLevelControlsMutation
  >;
}

const BoseContext = createContext<BoseContextType | null>(null);

export const BoseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const scanner = useBoseScanner();
  const volumeMutation = useVolumeMutation();
  const powerToggleMutation = usePowerToggleMutation();
  const playPauseMutation = usePlayPauseMutation();
  const keyMutation = useKeyMutation();
  const selectSourceMutation = useSelectSourceMutation();
  const setBassMutation = useSetBassMutation();
  const savePresetMutation = useSavePresetMutation();
  const playStreamMutation = usePlayStreamMutation();
  const setNameMutation = useSetNameMutation();
  const setAudioDspControlsMutation = useSetAudioDspControlsMutation();
  const setAudioProductToneControlsMutation =
    useSetAudioProductToneControlsMutation();
  const setAudioProductLevelControlsMutation =
    useSetAudioProductLevelControlsMutation();

  return (
    <BoseContext.Provider
      value={{
        ...scanner,
        volumeMutation,
        powerToggleMutation,
        playPauseMutation,
        keyMutation,
        selectSourceMutation,
        setBassMutation,
        savePresetMutation,
        playStreamMutation,
        setNameMutation,
        setAudioDspControlsMutation,
        setAudioProductToneControlsMutation,
        setAudioProductLevelControlsMutation,
      }}
    >
      {children}
    </BoseContext.Provider>
  );
};

export const useBose = () => {
  const context = useContext(BoseContext);
  if (!context) {
    throw new Error("useBose must be used within a BoseProvider");
  }
  return context;
};
