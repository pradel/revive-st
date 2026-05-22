import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Image,
  Alert,
  type GestureResponderEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useBose } from "@/features/speakers/contexts/BoseContext";
import { logger } from "@/lib/logger";

export default function SpeakerDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    speakers,
    togglePower,
    changeVolume,
    playPause,
    triggerKey,
    selectSource,
    loadPresets,
    loadBass,
    savePreset,
    setBass,
  } = useBose();

  const speaker = speakers.find((item) => item.deviceID === id);
  const [sliderWidth, setSliderWidth] = useState(0);
  const [bassSliderWidth, setBassSliderWidth] = useState(0);
  const [savingPresetId, setSavingPresetId] = useState<number | null>(null);

  useEffect(() => {
    if (speaker) {
      void loadPresets(speaker.deviceID);
      void loadBass(speaker.deviceID);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!speaker) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>🔍</Text>
          <Text style={styles.errorTitle}>Speaker Offline</Text>
          <Text style={styles.errorText}>
            This speaker is no longer detected on your local network.
          </Text>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              router.back();
            }}
          >
            <Text style={styles.backButtonText}>Return to Dashboard</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isStandby =
    speaker.source === "STANDBY" || speaker.playStatus === "STANDBY";

  const handleSliderPress = (event: GestureResponderEvent) => {
    if (sliderWidth <= 0) {
      return;
    }
    const touchX = event.nativeEvent.locationX;
    const percentage = Math.max(0, Math.min(1, touchX / sliderWidth));
    const newVolume = Math.round(percentage * 100);
    void changeVolume(speaker.deviceID, newVolume);
  };

  const adjustVolumeStep = (delta: number) => {
    const currentVol = speaker.volume ?? 30;
    const newVol = Math.max(0, Math.min(100, currentVol + delta));
    void changeVolume(speaker.deviceID, newVol);
  };

  const handleBassSliderPress = (event: GestureResponderEvent) => {
    if (bassSliderWidth <= 0) {
      return;
    }
    const touchX = event.nativeEvent.locationX;
    const percentage = Math.max(0, Math.min(1, touchX / bassSliderWidth));
    // Bass goes from -9 to 0
    const newBass = -9 + Math.round(percentage * 9);
    void setBass(speaker.deviceID, newBass);
  };

  const adjustBassStep = (delta: number) => {
    const currentBass = speaker.bass ?? -5;
    const newBass = Math.max(-9, Math.min(0, currentBass + delta));
    void setBass(speaker.deviceID, newBass);
  };

  const handleToggleMute = () => {
    void triggerKey(speaker.deviceID, "MUTE");
  };

  const handleNextTrack = () => {
    void triggerKey(speaker.deviceID, "NEXT_TRACK");
  };

  const handlePrevTrack = () => {
    void triggerKey(speaker.deviceID, "PREV_TRACK");
  };

  const handlePresetPress = (presetId: number) => {
    void triggerKey(speaker.deviceID, `PRESET_${presetId}`);
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
              await savePreset(speaker.deviceID, presetId);
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerIconButton}
          onPress={() => {
            router.back();
          }}
        >
          <Text style={styles.headerIconText}>←</Text>
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {speaker.name}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isStandby ? "Standby" : getSourceLabel(activeSource)}
          </Text>
        </View>

        <Pressable
          style={[
            styles.headerPowerButton,
            isStandby ? styles.powerOff : styles.powerOn,
          ]}
          onPress={() => {
            void togglePower(speaker.deviceID);
          }}
          disabled={speaker.isUpdating}
        >
          {speaker.isUpdating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.powerIconText}>⏻</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isStandby ? (
          /* Standby View */
          <View style={styles.standbyCard}>
            <View style={styles.standbyGlowContainer}>
              <View style={styles.standbyOuterCircle}>
                <View style={styles.standbyInnerCircle}>
                  <Text style={styles.standbyIcon}>💤</Text>
                </View>
              </View>
            </View>
            <Text style={styles.standbyTitle}>Speaker is Asleep</Text>
            <Text style={styles.standbySubtitle}>
              Tap the power icon above or press below to wake up your speaker.
            </Text>
            <Pressable
              style={styles.wakeButton}
              onPress={() => {
                void togglePower(speaker.deviceID);
              }}
              disabled={speaker.isUpdating}
            >
              {speaker.isUpdating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.wakeButtonText}>Power On Speaker</Text>
              )}
            </Pressable>
          </View>
        ) : (
          /* Active Playing View */
          <View style={styles.activeContainer}>
            {/* Album Art Card */}
            <View style={styles.albumArtContainer}>
              {speaker.artUrl ? (
                <Image
                  source={{ uri: speaker.artUrl }}
                  style={styles.albumArt}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.albumArtPlaceholder}>
                  <Text style={styles.placeholderEmoji}>🎵</Text>
                  <Text style={styles.placeholderText}>Bose SoundTouch</Text>
                </View>
              )}
            </View>

            {/* Track Info */}
            <View style={styles.trackInfoContainer}>
              <Text style={styles.trackName} numberOfLines={2}>
                {speaker.track ?? "Nothing Playing"}
              </Text>
              <Text style={styles.artistName} numberOfLines={1}>
                {speaker.artist ?? "Unknown Artist"}
              </Text>
              {speaker.album ? (
                <Text style={styles.albumName} numberOfLines={1}>
                  {speaker.album}
                </Text>
              ) : null}

              <View
                style={[
                  styles.sourceBadge,
                  { backgroundColor: getSourceBadgeColor(activeSource) },
                ]}
              >
                <Text style={styles.sourceText}>
                  {getSourceLabel(activeSource)}
                </Text>
              </View>
            </View>

            {/* Playback Controls Panel */}
            <View style={styles.panel}>
              <View style={styles.controlsRow}>
                {/* Skip Back */}
                <Pressable
                  style={styles.controlButton}
                  onPress={handlePrevTrack}
                >
                  <Text style={styles.controlButtonText}>⏮</Text>
                </Pressable>

                {/* Play/Pause */}
                <Pressable
                  style={styles.mainPlayButton}
                  onPress={() => {
                    void playPause(speaker.deviceID);
                  }}
                  disabled={speaker.isUpdating}
                >
                  {speaker.isUpdating ? (
                    <ActivityIndicator size="small" color="#09090b" />
                  ) : (
                    <Text style={styles.mainPlayButtonText}>
                      {speaker.playStatus === "PLAY_STATE" ? "⏸" : "▶"}
                    </Text>
                  )}
                </Pressable>

                {/* Skip Forward */}
                <Pressable
                  style={styles.controlButton}
                  onPress={handleNextTrack}
                >
                  <Text style={styles.controlButtonText}>⏭</Text>
                </Pressable>
              </View>
            </View>

            {/* Volume Panel */}
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Volume</Text>
                <Text style={styles.panelValue}>
                  {speaker.muteEnabled ? "Muted" : `${speaker.volume ?? 0}%`}
                </Text>
              </View>

              <View style={styles.volumeRow}>
                {/* Mute Button */}
                <Pressable
                  style={[
                    styles.volumeButton,
                    speaker.muteEnabled && styles.volumeButtonActive,
                  ]}
                  onPress={handleToggleMute}
                >
                  <Text style={styles.volumeButtonText}>
                    {speaker.muteEnabled || speaker.volume === 0 ? "🔇" : "🔊"}
                  </Text>
                </Pressable>

                {/* Volume Slider */}
                <View style={styles.sliderContainer}>
                  <Pressable
                    style={styles.volTrack}
                    onLayout={(event) => {
                      setSliderWidth(event.nativeEvent.layout.width);
                    }}
                    onPress={handleSliderPress}
                  >
                    <View
                      style={[
                        styles.volFill,
                        {
                          width: `${speaker.muteEnabled ? 0 : (speaker.volume ?? 30)}%`,
                        },
                      ]}
                    />
                  </Pressable>
                </View>

                {/* Precise Steppers */}
                <View style={styles.steppersContainer}>
                  <Pressable
                    style={styles.stepButton}
                    onPress={() => {
                      adjustVolumeStep(-5);
                    }}
                  >
                    <Text style={styles.stepButtonText}>-</Text>
                  </Pressable>
                  <Pressable
                    style={styles.stepButton}
                    onPress={() => {
                      adjustVolumeStep(5);
                    }}
                  >
                    <Text style={styles.stepButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Acoustic Bass Tuning Panel */}
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Bass Tuning</Text>
                <Text style={styles.panelValue}>{speaker.bass ?? "..."}</Text>
              </View>

              <View style={styles.volumeRow}>
                <View style={styles.sliderContainer}>
                  <Pressable
                    style={styles.volTrack}
                    onLayout={(event) => {
                      setBassSliderWidth(event.nativeEvent.layout.width);
                    }}
                    onPress={handleBassSliderPress}
                  >
                    <View
                      style={[
                        styles.volFill,
                        {
                          // Amber accent color for bass tuning
                          backgroundColor: "#f59e0b",
                          // Bass range is -9 to 0. Mapped to percentage.
                          width: `${
                            speaker.bass !== undefined
                              ? ((speaker.bass + 9) / 9) * 100
                              : 50
                          }%`,
                        },
                      ]}
                    />
                  </Pressable>
                </View>

                {/* Bass Steppers */}
                <View style={styles.steppersContainer}>
                  <Pressable
                    style={styles.stepButton}
                    onPress={() => {
                      adjustBassStep(-1);
                    }}
                  >
                    <Text style={styles.stepButtonText}>-</Text>
                  </Pressable>
                  <Pressable
                    style={styles.stepButton}
                    onPress={() => {
                      adjustBassStep(1);
                    }}
                  >
                    <Text style={styles.stepButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Presets Grid Panel */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Quick Presets (1-6)</Text>
              <View style={styles.presetGrid}>
                {[1, 2, 3, 4, 5, 6].map((num) => {
                  const preset = speaker.presets?.find(
                    (sPreset) => sPreset.id === num,
                  );
                  const isSaving = savingPresetId === num;

                  return (
                    <Pressable
                      key={num}
                      style={[
                        styles.presetCard,
                        preset && styles.presetCardActive,
                      ]}
                      onPress={() => {
                        handlePresetPress(num);
                      }}
                      onLongPress={() => {
                        handlePresetLongPress(num);
                      }}
                      delayLongPress={600}
                    >
                      <View style={styles.presetHeader}>
                        <View
                          style={[
                            styles.presetBadge,
                            preset && styles.presetBadgeActive,
                          ]}
                        >
                          <Text style={styles.presetBadgeText}>{num}</Text>
                        </View>

                        {preset && (
                          <View
                            style={[
                              styles.presetSourceBadge,
                              {
                                backgroundColor: getSourceBadgeColor(
                                  preset.contentItem.source,
                                ),
                              },
                            ]}
                          >
                            <Text style={styles.presetSourceText}>
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
                            styles.presetName,
                            preset
                              ? styles.presetNameFilled
                              : styles.presetNameEmpty,
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
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Input Source</Text>
              <View style={styles.sourcesGrid}>
                {/* Bluetooth Selector */}
                <Pressable
                  style={[
                    styles.sourceCard,
                    speaker.source === "BLUETOOTH" && styles.sourceCardActive,
                  ]}
                  onPress={() =>
                    void selectSource(speaker.deviceID, "BLUETOOTH")
                  }
                >
                  <Text style={styles.sourceCardEmoji}>📱</Text>
                  <Text style={styles.sourceCardText}>Bluetooth</Text>
                </Pressable>

                {/* AUX Selector */}
                <Pressable
                  style={[
                    styles.sourceCard,
                    speaker.source === "AUX" && styles.sourceCardActive,
                  ]}
                  onPress={() =>
                    void selectSource(speaker.deviceID, "AUX", "AUX")
                  }
                >
                  <Text style={styles.sourceCardEmoji}>🔌</Text>
                  <Text style={styles.sourceCardText}>Auxiliary</Text>
                </Pressable>

                {/* Wi-Fi Selector */}
                <Pressable
                  style={[
                    styles.sourceCard,
                    speaker.source !== "BLUETOOTH" &&
                      speaker.source !== "AUX" &&
                      styles.sourceCardActive,
                  ]}
                  onPress={() => {
                    void selectSource(speaker.deviceID, "TUNEIN");
                  }}
                >
                  <Text style={styles.sourceCardEmoji}>🌐</Text>
                  <Text style={styles.sourceCardText}>Wi-Fi Audio</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Deep zinc black background
    backgroundColor: "#09090b",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    color: "#fafafa",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  errorText: {
    color: "#a1a1aa",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fafafa",
    fontWeight: "600",
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#18181b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  headerIconText: {
    color: "#fafafa",
    fontSize: 20,
    fontWeight: "bold",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 12,
  },
  headerTitle: {
    color: "#fafafa",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  headerSubtitle: {
    color: "#a1a1aa",
    fontSize: 12,
    marginTop: 2,
  },
  headerPowerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  powerIconText: {
    color: "#fafafa",
    fontSize: 18,
    fontWeight: "bold",
  },
  powerOn: {
    backgroundColor: "rgba(22, 163, 74, 0.2)",
    borderColor: "#16a34a",
  },
  powerOff: {
    backgroundColor: "rgba(39, 39, 42, 0.4)",
    borderColor: "#3f3f46",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  /* Standby Styles */
  standbyCard: {
    backgroundColor: "rgba(24, 24, 27, 0.6)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 32,
    alignItems: "center",
    marginTop: 40,
  },
  standbyGlowContainer: {
    marginBottom: 24,
  },
  standbyOuterCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.3)",
  },
  standbyInnerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(37, 99, 235, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  standbyIcon: {
    fontSize: 36,
  },
  standbyTitle: {
    color: "#fafafa",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },
  standbySubtitle: {
    color: "#a1a1aa",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  wakeButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  wakeButtonText: {
    color: "#fafafa",
    fontSize: 16,
    fontWeight: "bold",
  },
  /* Active Player Styles */
  activeContainer: {
    alignItems: "stretch",
  },
  albumArtContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 24,
    backgroundColor: "#18181b",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#27272a",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 24,
  },
  albumArt: {
    width: "100%",
    height: "100%",
  },
  albumArtPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(39, 39, 42, 0.3)",
  },
  placeholderEmoji: {
    fontSize: 72,
    opacity: 0.5,
    marginBottom: 12,
  },
  placeholderText: {
    color: "#71717a",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  trackInfoContainer: {
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  trackName: {
    color: "#fafafa",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 6,
  },
  artistName: {
    color: "#a1a1aa",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 4,
  },
  albumName: {
    color: "#71717a",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
  sourceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  sourceText: {
    color: "#fafafa",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  panel: {
    backgroundColor: "rgba(24, 24, 27, 0.6)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 16,
    marginBottom: 16,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  panelTitle: {
    color: "#71717a",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  panelValue: {
    color: "#fafafa",
    fontSize: 14,
    fontWeight: "bold",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 32,
    paddingVertical: 8,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonText: {
    color: "#fafafa",
    fontSize: 18,
  },
  mainPlayButton: {
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
  },
  mainPlayButtonText: {
    color: "#09090b",
    fontSize: 28,
    // Slight adjustment to center triangle visually
    marginLeft: 4,
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  volumeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#18181b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  volumeButtonActive: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#ef4444",
  },
  volumeButtonText: {
    fontSize: 16,
  },
  sliderContainer: {
    flex: 1,
    justifyContent: "center",
  },
  volTrack: {
    height: 8,
    backgroundColor: "#18181b",
    borderRadius: 4,
    overflow: "hidden",
  },
  volFill: {
    height: "100%",
    backgroundColor: "#2563eb",
    borderRadius: 4,
  },
  steppersContainer: {
    flexDirection: "row",
    gap: 6,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#18181b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  stepButtonText: {
    color: "#fafafa",
    fontSize: 16,
    fontWeight: "bold",
  },
  /* Presets Grid */
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  presetCard: {
    // Grid layout
    width: "48%",
    aspectRatio: 1.3,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    padding: 10,
    justifyContent: "space-between",
  },
  presetCardActive: {
    // Amber highlight for assigned presets
    borderColor: "rgba(245, 158, 11, 0.4)",
    backgroundColor: "rgba(245, 158, 11, 0.03)",
  },
  presetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  presetBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#27272a",
    justifyContent: "center",
    alignItems: "center",
  },
  presetBadgeActive: {
    // Amber glowing badge for presets
    backgroundColor: "#f59e0b",
  },
  presetBadgeText: {
    color: "#fafafa",
    fontSize: 12,
    fontWeight: "bold",
  },
  presetSourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  presetSourceText: {
    color: "#fafafa",
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  presetName: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  presetNameFilled: {
    color: "#fafafa",
  },
  presetNameEmpty: {
    color: "#71717a",
    fontStyle: "italic",
  },
  sourcesGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  sourceCard: {
    flex: 1,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    gap: 6,
  },
  sourceCardActive: {
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    borderColor: "#2563eb",
  },
  sourceCardEmoji: {
    fontSize: 20,
  },
  sourceCardText: {
    color: "#fafafa",
    fontSize: 12,
    fontWeight: "600",
  },
});
