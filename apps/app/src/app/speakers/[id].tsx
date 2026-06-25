import type { KeyValue } from "bose-api-speaker-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Image,
  Alert,
  type TextStyle,
  type ViewStyle,
  type ImageStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Slider } from "@/components/ui/Slider";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import { logger } from "@/lib/logger";

export default function SpeakerDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    speakers,
    powerToggleMutation,
    volumeMutation,
    playPauseMutation,
    keyMutation,
    selectSourceMutation,
    loadPresets,
    loadBass,
    savePresetMutation,
    setBassMutation,
  } = useBose();

  const speaker = speakers.find((item) => item.deviceID === id);
  const [savingPresetId, setSavingPresetId] = useState<number | null>(null);

  const [localVolume, setLocalVolume] = useState<number | null>(null);
  const [localBass, setLocalBass] = useState<number | null>(null);

  useEffect(() => {
    if (speaker) {
      void loadPresets(speaker.deviceID);
      void loadBass(speaker.deviceID);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!speaker) {
    return (
      <SafeAreaView style={$container}>
        <View style={$errorContainer}>
          <Text style={$errorEmoji}>🔍</Text>
          <Text style={$errorTitle}>Speaker Offline</Text>
          <Text style={$errorText}>
            This speaker is no longer detected on your local network.
          </Text>
          <Pressable
            style={$backButton}
            onPress={() => {
              router.back();
            }}
          >
            <Text style={$backButtonText}>Return to Dashboard</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isStandby =
    speaker.source === "STANDBY" || speaker.playStatus === "STANDBY";

  const adjustVolumeStep = (delta: number) => {
    const currentVol = speaker.volume ?? 30;
    const newVol = Math.max(0, Math.min(100, currentVol + delta));
    volumeMutation.mutate({ deviceID: speaker.deviceID, volume: newVol });
  };

  const adjustBassStep = (delta: number) => {
    const currentBass = speaker.bass ?? -5;
    const newBass = Math.max(-9, Math.min(0, currentBass + delta));
    setBassMutation.mutate({ deviceID: speaker.deviceID, value: newBass });
  };

  const handleToggleMute = () => {
    keyMutation.mutate({ deviceID: speaker.deviceID, key: "MUTE" });
  };

  const handleNextTrack = () => {
    keyMutation.mutate({ deviceID: speaker.deviceID, key: "NEXT_TRACK" });
  };

  const handlePrevTrack = () => {
    keyMutation.mutate({ deviceID: speaker.deviceID, key: "PREV_TRACK" });
  };

  const handlePresetPress = (presetId: number) => {
    keyMutation.mutate({
      deviceID: speaker.deviceID,
      key: `PRESET_${presetId}` as KeyValue,
    });
  };

  const handlePresetLongPress = (presetId: number) => {
    if (isStandby || !speaker.track) {
      Alert.alert(
        "Cannot Save Preset",
        "Please play a streaming music source (e.g. Spotify Connect, Wi-Fi Radio) on this speaker before saving it to a preset.",
      );
      return;
    }

    Alert.alert(
      "Save Preset",
      `Would you like to assign the currently playing stream ("${speaker.track}") to Preset Slot ${presetId}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          // oxlint-disable-next-line typescript/no-misused-promises
          onPress: async () => {
            try {
              setSavingPresetId(presetId);
              await savePresetMutation.mutateAsync({
                deviceID: speaker.deviceID,
                presetId,
              });
            } catch (err) {
              logger.warn("[SpeakerDetail] Failed to save preset:", err);
              Alert.alert(
                "Error",
                "Failed to assign preset. Please try again.",
              );
            } finally {
              setSavingPresetId(null);
            }
          },
        },
      ],
    );
  };

  const getSourceLabel = (src: string) => {
    switch (src) {
      case "BLUETOOTH":
        return "Bluetooth";
      case "AUX":
        return "Auxiliary Input";
      case "STANDBY":
        return "Standby";
      case "INTERNET_RADIO":
        return "Internet Radio";
      case "PANDORA":
        return "Pandora";
      case "DEEZER":
        return "Deezer";
      case "SPOTIFY":
        return "Spotify Connect";
      case "AIRPLAY":
        return "AirPlay";
      case "STORED_MUSIC":
        return "Local Music Library";
      default:
        return src;
    }
  };

  const getSourceBadgeColor = (src: string) => {
    switch (src) {
      case "BLUETOOTH":
        // Blue
        return "#2563eb";
      case "AUX":
        // Amber
        return "#d97706";
      case "STANDBY":
        // Gray
        return "#4b5563";
      case "INTERNET_RADIO":
      case "SPOTIFY":
        // Green
        return "#16a34a";
      default:
        // Purple
        return "#8b5cf6";
    }
  };

  const activeSource = speaker.source ?? "STANDBY";

  return (
    <SafeAreaView style={$container}>
      {/* Header */}
      <View style={$header}>
        <Pressable
          style={$headerIconButton}
          onPress={() => {
            router.back();
          }}
        >
          <Text style={$headerIconText}>←</Text>
        </Pressable>

        <View style={$headerTitleContainer}>
          <Text style={$headerTitle} numberOfLines={1}>
            {speaker.name}
          </Text>
          <Text style={$headerSubtitle}>
            {isStandby ? "Standby" : getSourceLabel(activeSource)}
          </Text>
        </View>

        <Pressable
          style={[$headerPowerButton, isStandby ? $powerOff : $powerOn]}
          onPress={() => {
            powerToggleMutation.mutate({ deviceID: speaker.deviceID });
          }}
          disabled={speaker.isUpdating}
        >
          {speaker.isUpdating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={$powerIconText}>⏻</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={$scrollContent}>
        {isStandby ? (
          /* Standby View */
          <View style={$standbyCard}>
            <View style={$standbyGlowContainer}>
              <View style={$standbyOuterCircle}>
                <View style={$standbyInnerCircle}>
                  <Text style={$standbyIcon}>💤</Text>
                </View>
              </View>
            </View>
            <Text style={$standbyTitle}>Speaker is Asleep</Text>
            <Text style={$standbySubtitle}>
              Tap the power icon above or press below to wake up your speaker.
            </Text>
            <Pressable
              style={$wakeButton}
              onPress={() => {
                powerToggleMutation.mutate({ deviceID: speaker.deviceID });
              }}
              disabled={speaker.isUpdating}
            >
              {speaker.isUpdating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={$wakeButtonText}>Power On Speaker</Text>
              )}
            </Pressable>
          </View>
        ) : (
          /* Active Playing View */
          <View style={$activeContainer}>
            {/* Album Art Card */}
            <View style={$albumArtContainer}>
              {speaker.artUrl ? (
                <Image
                  source={{ uri: speaker.artUrl }}
                  style={$albumArt}
                  resizeMode="cover"
                />
              ) : (
                <View style={$albumArtPlaceholder}>
                  <Text style={$placeholderEmoji}>🎵</Text>
                  <Text style={$placeholderText}>Bose SoundTouch</Text>
                </View>
              )}
            </View>

            {/* Track Info */}
            <View style={$trackInfoContainer}>
              <Text style={$trackName} numberOfLines={2}>
                {speaker.track ?? "Nothing Playing"}
              </Text>
              <Text style={$artistName} numberOfLines={1}>
                {speaker.artist ?? "Unknown Artist"}
              </Text>
              {speaker.album ? (
                <Text style={$albumName} numberOfLines={1}>
                  {speaker.album}
                </Text>
              ) : null}

              <View
                style={[
                  $sourceBadge,
                  { backgroundColor: getSourceBadgeColor(activeSource) },
                ]}
              >
                <Text style={$sourceText}>{getSourceLabel(activeSource)}</Text>
              </View>
            </View>

            {/* Playback Controls Panel */}
            <View style={$panel}>
              <View style={$controlsRow}>
                {/* Skip Back */}
                <Pressable style={$controlButton} onPress={handlePrevTrack}>
                  <Text style={$controlButtonText}>⏮</Text>
                </Pressable>

                {/* Play/Pause */}
                <Pressable
                  style={$mainPlayButton}
                  onPress={() => {
                    playPauseMutation.mutate({ deviceID: speaker.deviceID });
                  }}
                  disabled={speaker.isUpdating}
                >
                  {speaker.isUpdating ? (
                    <ActivityIndicator size="small" color="#09090b" />
                  ) : (
                    <Text style={$mainPlayButtonText}>
                      {speaker.playStatus === "PLAY_STATE" ? "⏸" : "▶"}
                    </Text>
                  )}
                </Pressable>

                {/* Skip Forward */}
                <Pressable style={$controlButton} onPress={handleNextTrack}>
                  <Text style={$controlButtonText}>⏭</Text>
                </Pressable>
              </View>
            </View>

            {/* Volume Panel */}
            <View style={$panel}>
              <View style={$panelHeader}>
                <Text style={$panelTitle}>Volume</Text>
                <Text style={$panelValue}>
                  {speaker.muteEnabled
                    ? "Muted"
                    : `${localVolume ?? speaker.volume ?? 0}%`}
                </Text>
              </View>

              <View style={$volumeRow}>
                {/* Mute Button */}
                <Pressable
                  style={[
                    $volumeButton,
                    speaker.muteEnabled && $volumeButtonActive,
                  ]}
                  onPress={handleToggleMute}
                >
                  <Text style={$volumeButtonText}>
                    {speaker.muteEnabled || speaker.volume === 0 ? "🔇" : "🔊"}
                  </Text>
                </Pressable>

                {/* Volume Slider */}
                <View style={$sliderContainer}>
                  <Slider
                    value={speaker.muteEnabled ? 0 : (speaker.volume ?? 30)}
                    minimumValue={0}
                    maximumValue={100}
                    onValueChange={(val) => {
                      setLocalVolume(Math.round(val));
                    }}
                    onSlidingComplete={(val) => {
                      setLocalVolume(null);
                      volumeMutation.mutate({
                        deviceID: speaker.deviceID,
                        volume: val,
                      });
                    }}
                  />
                </View>

                {/* Precise Steppers */}
                <View style={$steppersContainer}>
                  <Pressable
                    style={$stepButton}
                    onPress={() => {
                      adjustVolumeStep(-5);
                    }}
                  >
                    <Text style={$stepButtonText}>-</Text>
                  </Pressable>
                  <Pressable
                    style={$stepButton}
                    onPress={() => {
                      adjustVolumeStep(5);
                    }}
                  >
                    <Text style={$stepButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Acoustic Bass Tuning Panel */}
            <View style={$panel}>
              <View style={$panelHeader}>
                <Text style={$panelTitle}>Bass Tuning</Text>
                <Text style={$panelValue}>
                  {localBass ?? speaker.bass ?? "..."}
                </Text>
              </View>

              <View style={$volumeRow}>
                <View style={$sliderContainer}>
                  <Slider
                    value={speaker.bass ?? -5}
                    minimumValue={-9}
                    maximumValue={0}
                    fillColor="#f59e0b"
                    onValueChange={(val) => {
                      setLocalBass(Math.round(val));
                    }}
                    onSlidingComplete={(val) => {
                      setLocalBass(null);
                      setBassMutation.mutate({
                        deviceID: speaker.deviceID,
                        value: val,
                      });
                    }}
                  />
                </View>

                {/* Bass Steppers */}
                <View style={$steppersContainer}>
                  <Pressable
                    style={$stepButton}
                    onPress={() => {
                      adjustBassStep(-1);
                    }}
                  >
                    <Text style={$stepButtonText}>-</Text>
                  </Pressable>
                  <Pressable
                    style={$stepButton}
                    onPress={() => {
                      adjustBassStep(1);
                    }}
                  >
                    <Text style={$stepButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Presets Grid Panel */}
            <View style={$panel}>
              <Text style={$panelTitle}>Quick Presets (1-6)</Text>
              <View style={$presetGrid}>
                {[1, 2, 3, 4, 5, 6].map((num) => {
                  const preset = speaker.presets?.find(
                    (sPreset) => sPreset.id === num,
                  );
                  const isSaving = savingPresetId === num;

                  return (
                    <Pressable
                      key={num}
                      style={[$presetCard, preset && $presetCardActive]}
                      onPress={() => {
                        handlePresetPress(num);
                      }}
                      onLongPress={() => {
                        handlePresetLongPress(num);
                      }}
                      delayLongPress={600}
                    >
                      <View style={$presetHeader}>
                        <View
                          style={[$presetBadge, preset && $presetBadgeActive]}
                        >
                          <Text style={$presetBadgeText}>{num}</Text>
                        </View>

                        {preset && (
                          <View
                            style={[
                              $presetSourceBadge,
                              {
                                backgroundColor: getSourceBadgeColor(
                                  preset.contentItem.source,
                                ),
                              },
                            ]}
                          >
                            <Text style={$presetSourceText}>
                              {preset.contentItem.source === "INTERNET_RADIO"
                                ? "Radio"
                                : preset.contentItem.source}
                            </Text>
                          </View>
                        )}
                      </View>

                      {isSaving ? (
                        <ActivityIndicator
                          size="small"
                          color="#fafafa"
                          style={{ marginVertical: 4 }}
                        />
                      ) : (
                        <Text
                          style={[
                            $presetName,
                            preset ? $presetNameFilled : $presetNameEmpty,
                          ]}
                          numberOfLines={2}
                        >
                          {preset
                            ? preset.contentItem.itemName
                            : "Hold to Assign"}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Sources Selector Panel */}
            <View style={$panel}>
              <Text style={$panelTitle}>Input Source</Text>
              <View style={$sourcesGrid}>
                {/* Bluetooth Selector */}
                <Pressable
                  style={[
                    $sourceCard,
                    speaker.source === "BLUETOOTH" && $sourceCardActive,
                  ]}
                  onPress={() => {
                    selectSourceMutation.mutate({
                      deviceID: speaker.deviceID,
                      source: "BLUETOOTH",
                    });
                  }}
                >
                  <Text style={$sourceCardEmoji}>📱</Text>
                  <Text style={$sourceCardText}>Bluetooth</Text>
                </Pressable>

                {/* AUX Selector */}
                <Pressable
                  style={[
                    $sourceCard,
                    speaker.source === "AUX" && $sourceCardActive,
                  ]}
                  onPress={() => {
                    selectSourceMutation.mutate({
                      deviceID: speaker.deviceID,
                      source: "AUX",
                      sourceAccount: "AUX",
                    });
                  }}
                >
                  <Text style={$sourceCardEmoji}>🔌</Text>
                  <Text style={$sourceCardText}>Auxiliary</Text>
                </Pressable>

                {/* Wi-Fi Selector */}
                <Pressable
                  style={[
                    $sourceCard,
                    speaker.source !== "BLUETOOTH" &&
                      speaker.source !== "AUX" &&
                      $sourceCardActive,
                  ]}
                  onPress={() => {
                    selectSourceMutation.mutate({
                      deviceID: speaker.deviceID,
                      source: "TUNEIN",
                    });
                  }}
                >
                  <Text style={$sourceCardEmoji}>🌐</Text>
                  <Text style={$sourceCardText}>Wi-Fi Audio</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: "#09090b",
};

const $errorContainer: ViewStyle = {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  padding: 24,
};

const $errorEmoji: TextStyle = {
  fontSize: 64,
  marginBottom: 16,
};

const $errorTitle: TextStyle = {
  color: "#fafafa",
  fontSize: 24,
  fontWeight: "bold",
  marginBottom: 8,
};

const $errorText: TextStyle = {
  color: "#a1a1aa",
  fontSize: 16,
  textAlign: "center",
  marginBottom: 24,
};

const $backButton: ViewStyle = {
  backgroundColor: "#2563eb",
  paddingHorizontal: 24,
  paddingVertical: 12,
  borderRadius: 8,
};

const $backButtonText: TextStyle = {
  color: "#fafafa",
  fontWeight: "600",
  fontSize: 16,
};

const $header: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 16,
  paddingVertical: 12,
};

const $headerIconButton: ViewStyle = {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: "#18181b",
  justifyContent: "center",
  alignItems: "center",
};

const $headerIconText: TextStyle = {
  color: "#fafafa",
  fontSize: 20,
  fontWeight: "bold",
};

const $headerTitleContainer: ViewStyle = {
  flex: 1,
  alignItems: "center",
  marginHorizontal: 12,
};

const $headerTitle: TextStyle = {
  color: "#fafafa",
  fontSize: 18,
  fontWeight: "bold",
  textAlign: "center",
};

const $headerSubtitle: TextStyle = {
  color: "#a1a1aa",
  fontSize: 12,
  marginTop: 2,
};

const $headerPowerButton: ViewStyle = {
  width: 40,
  height: 40,
  borderRadius: 20,
  justifyContent: "center",
  alignItems: "center",
};

const $powerIconText: TextStyle = {
  color: "#fafafa",
  fontSize: 18,
  fontWeight: "bold",
};

const $powerOn: ViewStyle = {
  backgroundColor: "rgba(22, 163, 74, 0.2)",
};

const $powerOff: ViewStyle = {
  backgroundColor: "rgba(39, 39, 42, 0.4)",
};

const $scrollContent: ViewStyle = {
  padding: 20,
  paddingBottom: 40,
};

const $standbyCard: ViewStyle = {
  backgroundColor: "rgba(24, 24, 27, 0.6)",
  borderRadius: 24,
  padding: 32,
  alignItems: "center",
  marginTop: 40,
};

const $standbyGlowContainer: ViewStyle = {
  marginBottom: 24,
};

const $standbyOuterCircle: ViewStyle = {
  width: 120,
  height: 120,
  borderRadius: 60,
  backgroundColor: "rgba(37, 99, 235, 0.1)",
  justifyContent: "center",
  alignItems: "center",
};

const $standbyInnerCircle: ViewStyle = {
  width: 80,
  height: 80,
  borderRadius: 40,
  backgroundColor: "rgba(37, 99, 235, 0.2)",
  justifyContent: "center",
  alignItems: "center",
};

const $standbyIcon: TextStyle = {
  fontSize: 36,
};

const $standbyTitle: TextStyle = {
  color: "#fafafa",
  fontSize: 22,
  fontWeight: "bold",
  marginBottom: 8,
};

const $standbySubtitle: TextStyle = {
  color: "#a1a1aa",
  fontSize: 14,
  textAlign: "center",
  lineHeight: 20,
  marginBottom: 28,
};

const $wakeButton: ViewStyle = {
  backgroundColor: "#2563eb",
  paddingHorizontal: 32,
  paddingVertical: 14,
  borderRadius: 12,
  shadowColor: "#2563eb",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 4,
};

const $wakeButtonText: TextStyle = {
  color: "#fafafa",
  fontSize: 16,
  fontWeight: "bold",
};

const $activeContainer: ViewStyle = {
  alignItems: "stretch",
};

const $albumArtContainer: ViewStyle = {
  width: "100%",
  aspectRatio: 1,
  borderRadius: 24,
  backgroundColor: "#18181b",
  overflow: "hidden",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.4,
  shadowRadius: 16,
  elevation: 8,
  marginBottom: 24,
};

const $albumArt: ImageStyle = {
  width: "100%",
  height: "100%",
};

const $albumArtPlaceholder: ViewStyle = {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "rgba(39, 39, 42, 0.3)",
};

const $placeholderEmoji: TextStyle = {
  fontSize: 72,
  opacity: 0.5,
  marginBottom: 12,
};

const $placeholderText: TextStyle = {
  color: "#71717a",
  fontSize: 14,
  fontWeight: "600",
  letterSpacing: 1,
  textTransform: "uppercase",
};

const $trackInfoContainer: ViewStyle = {
  alignItems: "center",
  marginBottom: 24,
  paddingHorizontal: 8,
};

const $trackName: TextStyle = {
  color: "#fafafa",
  fontSize: 24,
  fontWeight: "bold",
  textAlign: "center",
  marginBottom: 6,
};

const $artistName: TextStyle = {
  color: "#a1a1aa",
  fontSize: 16,
  textAlign: "center",
  marginBottom: 4,
};

const $albumName: TextStyle = {
  color: "#71717a",
  fontSize: 14,
  textAlign: "center",
  marginBottom: 12,
};

const $sourceBadge: ViewStyle = {
  paddingHorizontal: 12,
  paddingVertical: 4,
  borderRadius: 12,
  marginTop: 4,
};

const $sourceText: TextStyle = {
  color: "#fafafa",
  fontSize: 11,
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const $panel: ViewStyle = {
  backgroundColor: "rgba(24, 24, 27, 0.6)",
  borderRadius: 20,
  padding: 16,
  marginBottom: 16,
};

const $panelHeader: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};

const $panelTitle: TextStyle = {
  color: "#71717a",
  fontSize: 13,
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 8,
};

const $panelValue: TextStyle = {
  color: "#fafafa",
  fontSize: 14,
  fontWeight: "bold",
};

const $controlsRow: ViewStyle = {
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  gap: 32,
  paddingVertical: 8,
};

const $controlButton: ViewStyle = {
  width: 48,
  height: 48,
  borderRadius: 24,
  backgroundColor: "#18181b",
  justifyContent: "center",
  alignItems: "center",
};

const $controlButtonText: TextStyle = {
  color: "#fafafa",
  fontSize: 18,
};

const $mainPlayButton: ViewStyle = {
  width: 68,
  height: 68,
  borderRadius: 34,
  backgroundColor: "#fafafa",
  justifyContent: "center",
  alignItems: "center",
  shadowColor: "#fff",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 8,
  elevation: 4,
};

const $mainPlayButtonText: TextStyle = {
  color: "#09090b",
  fontSize: 28,
  marginLeft: 4,
};

const $volumeRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
};

const $volumeButton: ViewStyle = {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: "#18181b",
  justifyContent: "center",
  alignItems: "center",
};

const $volumeButtonActive: ViewStyle = {
  backgroundColor: "rgba(239, 68, 68, 0.15)",
};

const $volumeButtonText: TextStyle = {
  fontSize: 16,
};

const $sliderContainer: ViewStyle = {
  flex: 1,
  justifyContent: "center",
};

const $steppersContainer: ViewStyle = {
  flexDirection: "row",
  gap: 6,
};

const $stepButton: ViewStyle = {
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: "#18181b",
  justifyContent: "center",
  alignItems: "center",
};

const $stepButtonText: TextStyle = {
  color: "#fafafa",
  fontSize: 16,
  fontWeight: "bold",
};

const $presetGrid: ViewStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 4,
};

const $presetCard: ViewStyle = {
  width: "48%",
  aspectRatio: 1.3,
  backgroundColor: "#18181b",
  borderRadius: 12,
  padding: 10,
  justifyContent: "space-between",
};

const $presetCardActive: ViewStyle = {
  backgroundColor: "rgba(245, 158, 11, 0.03)",
};

const $presetHeader: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
};

const $presetBadge: ViewStyle = {
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: "#27272a",
  justifyContent: "center",
  alignItems: "center",
};

const $presetBadgeActive: ViewStyle = {
  backgroundColor: "#f59e0b",
};

const $presetBadgeText: TextStyle = {
  color: "#fafafa",
  fontSize: 12,
  fontWeight: "bold",
};

const $presetSourceBadge: ViewStyle = {
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 6,
};

const $presetSourceText: TextStyle = {
  color: "#fafafa",
  fontSize: 9,
  fontWeight: "bold",
  textTransform: "uppercase",
};

const $presetName: TextStyle = {
  fontSize: 12,
  fontWeight: "600",
  lineHeight: 16,
};

const $presetNameFilled: TextStyle = {
  color: "#fafafa",
};

const $presetNameEmpty: TextStyle = {
  color: "#71717a",
  fontStyle: "italic",
};

const $sourcesGrid: ViewStyle = {
  flexDirection: "row",
  gap: 10,
  marginTop: 4,
};

const $sourceCard: ViewStyle = {
  flex: 1,
  backgroundColor: "#18181b",
  borderRadius: 12,
  paddingVertical: 12,
  alignItems: "center",
  gap: 6,
};

const $sourceCardActive: ViewStyle = {
  backgroundColor: "rgba(37, 99, 235, 0.1)",
};

const $sourceCardEmoji: TextStyle = {
  fontSize: 20,
};

const $sourceCardText: TextStyle = {
  color: "#fafafa",
  fontSize: 12,
  fontWeight: "600",
};
