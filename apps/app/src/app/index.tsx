import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Image,
  GestureResponderEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { BoseSpeaker } from "@/features/speakers/hooks/useBoseScanner";
import { useBose } from "@/features/speakers/contexts/BoseContext";

export default function HomeIndex() {
  const router = useRouter();
  const {
    speakers,
    isScanning,
    error,
    rescan,
    togglePower,
    changeVolume,
    playPause,
  } = useBose();

  const handleSetupNew = () => {
    router.push("/onboarding/permissions" as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Revive ST</Text>
          <Text style={styles.headerSubtitle}>Bose SoundTouch Controller</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.iconButton, isScanning && styles.disabledButton]}
            onPress={rescan}
            disabled={isScanning}
          >
            <Text style={styles.iconButtonText}>🔄</Text>
          </Pressable>
          <Pressable style={styles.addButton} onPress={handleSetupNew}>
            <Text style={styles.addButtonText}>➕ Setup</Text>
          </Pressable>
        </View>
      </View>

      {isScanning && speakers.length === 0 && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#3b82f6"
            style={styles.spinner}
          />
          <Text style={styles.loadingText}>Scanning your Wi-Fi network...</Text>
          <Text style={styles.loadingSubtext}>
            Looking for Bose SoundTouch speakers
          </Text>
        </View>
      )}

      {!isScanning && speakers.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📡</Text>
          <Text style={styles.emptyTitle}>No Speakers Found</Text>
          <Text style={styles.emptyDescription}>
            We couldn't detect any Bose speakers on your Wi-Fi network. Make
            sure your speaker is turned on and connected to the same network.
          </Text>
          <Pressable style={styles.primaryButton} onPress={rescan}>
            <Text style={styles.primaryButtonText}>Scan Again</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleSetupNew}>
            <Text style={styles.secondaryButtonText}>Set Up New Speaker</Text>
          </Pressable>
        </View>
      )}

      {speakers.length > 0 && (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Speakers ({speakers.length})
            </Text>
            {isScanning && <ActivityIndicator size="small" color="#94a3b8" />}
          </View>

          {error && <Text style={styles.errorText}>Error: {error}</Text>}

          {speakers.map((speaker) => (
            <SpeakerCard
              key={speaker.deviceID}
              speaker={speaker}
              onTogglePower={togglePower}
              onChangeVolume={changeVolume}
              onPlayPause={playPause}
              onPress={() =>
                router.push(`/speakers/${speaker.deviceID}` as any)
              }
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

interface SpeakerCardProps {
  speaker: BoseSpeaker;
  onTogglePower: (id: string) => void;
  onChangeVolume: (id: string, vol: number) => void;
  onPlayPause: (id: string) => void;
  onPress: () => void;
}

function SpeakerCard({
  speaker,
  onTogglePower,
  onChangeVolume,
  onPlayPause,
  onPress,
}: SpeakerCardProps) {
  const isStandby =
    speaker.source === "STANDBY" || speaker.playStatus === "STANDBY";
  const [sliderWidth, setSliderWidth] = useState(0);

  const handleSliderPress = (e: GestureResponderEvent) => {
    if (sliderWidth <= 0) return;
    const touchX = e.nativeEvent.locationX;
    const percentage = Math.max(0, Math.min(1, touchX / sliderWidth));
    const newVolume = Math.round(percentage * 100);
    onChangeVolume(speaker.deviceID, newVolume);
  };

  const adjustVolumeStep = (delta: number) => {
    const currentVol = speaker.volume ?? 30;
    const newVol = Math.max(0, Math.min(100, currentVol + delta));
    onChangeVolume(speaker.deviceID, newVol);
  };

  return (
    <View style={[styles.card, isStandby && styles.cardStandby]}>
      {/* Top Header Row */}
      <View style={styles.cardHeader}>
        <Pressable style={styles.cardTitleContainer} onPress={onPress}>
          <Text style={styles.cardEmoji}>🔊</Text>
          <View>
            <Text style={styles.cardName}>{speaker.name}</Text>
            <Text style={styles.cardDetails}>
              {speaker.type} • {speaker.host}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={[
            styles.powerButton,
            isStandby ? styles.powerOff : styles.powerOn,
          ]}
          onPress={() => onTogglePower(speaker.deviceID)}
          disabled={speaker.isUpdating}
        >
          {speaker.isUpdating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.powerButtonText}>⏻</Text>
          )}
        </Pressable>
      </View>

      {/* Main Content Area */}
      {isStandby ? (
        <View style={styles.standbyContainer}>
          <Text style={styles.standbyText}>Standby Mode</Text>
          <Pressable
            style={styles.wakeButton}
            onPress={() => onTogglePower(speaker.deviceID)}
            disabled={speaker.isUpdating}
          >
            <Text style={styles.wakeButtonText}>Power On</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.activeContainer}>
          {/* Media Info Section */}
          <View style={styles.mediaRow}>
            <Pressable style={styles.mediaPressable} onPress={onPress}>
              {speaker.artUrl ? (
                <Image
                  source={{ uri: speaker.artUrl }}
                  style={styles.albumArt}
                />
              ) : (
                <View style={styles.albumArtPlaceholder}>
                  <Text style={styles.musicNote}>🎵</Text>
                </View>
              )}

              <View style={styles.mediaDetails}>
                <Text style={styles.trackName} numberOfLines={1}>
                  {speaker.track || "Nothing Playing"}
                </Text>
                <Text style={styles.artistName} numberOfLines={1}>
                  {speaker.artist || "Unknown Artist"}
                </Text>
                {speaker.album ? (
                  <Text style={styles.albumName} numberOfLines={1}>
                    {speaker.album}
                  </Text>
                ) : null}
                <View style={styles.sourceBadge}>
                  <Text style={styles.sourceText}>{speaker.source}</Text>
                </View>
              </View>
            </Pressable>

            {/* Play/Pause Button */}
            <Pressable
              style={styles.playPauseButton}
              onPress={() => onPlayPause(speaker.deviceID)}
              disabled={speaker.isUpdating}
            >
              <Text style={styles.playPauseButtonText}>
                {speaker.playStatus === "PLAY_STATE" ? "⏸" : "▶"}
              </Text>
            </Pressable>
          </View>

          {/* Volume Section */}
          <View style={styles.volumeContainer}>
            <Text style={styles.volumeLabel}>
              Volume: {speaker.volume ?? 0}%
            </Text>
            <View style={styles.volumeControlRow}>
              <Pressable
                style={styles.volStepButton}
                onPress={() => adjustVolumeStep(-5)}
              >
                <Text style={styles.volStepText}>-</Text>
              </Pressable>

              <Pressable
                style={styles.volTrack}
                onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
                onTouchStart={handleSliderPress}
                onTouchMove={handleSliderPress}
              >
                <View
                  style={[styles.volFill, { width: `${speaker.volume ?? 0}%` }]}
                />
              </Pressable>

              <Pressable
                style={styles.volStepButton}
                onPress={() => adjustVolumeStep(5)}
              >
                <Text style={styles.volStepText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090b", // Sleek zinc-950 dark background
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fafafa",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#a1a1aa",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    padding: 10,
    backgroundColor: "#18181b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    justifyContent: "center",
    alignItems: "center",
  },
  iconButtonText: {
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    justifyContent: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  spinner: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f4f4f5",
    marginBottom: 6,
  },
  loadingSubtext: {
    fontSize: 14,
    color: "#a1a1aa",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#f4f4f5",
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: "#a1a1aa",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryButton: {
    width: "100%",
    paddingVertical: 14,
    backgroundColor: "#2563eb",
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    width: "100%",
    paddingVertical: 14,
    backgroundColor: "#18181b",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#27272a",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#e4e4e7",
    fontSize: 16,
    fontWeight: "500",
  },
  listContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e4e4e7",
  },
  errorText: {
    color: "#ef4444",
    marginBottom: 16,
    fontSize: 14,
  },
  // Card Styles
  card: {
    backgroundColor: "#18181b", // Translucent-looking dark card
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cardStandby: {
    opacity: 0.75,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
    paddingBottom: 12,
    marginBottom: 12,
  },
  cardTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  cardEmoji: {
    fontSize: 24,
  },
  cardName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fafafa",
  },
  cardDetails: {
    fontSize: 12,
    color: "#71717a",
    marginTop: 2,
  },
  powerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  powerOn: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10b981",
  },
  powerOff: {
    backgroundColor: "rgba(113, 113, 122, 0.15)",
    borderWidth: 1,
    borderColor: "#71717a",
  },
  powerButtonText: {
    color: "#fafafa",
    fontSize: 18,
    fontWeight: "bold",
  },
  // Standby Area
  standbyContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  standbyText: {
    fontSize: 15,
    color: "#a1a1aa",
    fontWeight: "500",
  },
  wakeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#27272a",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  wakeButtonText: {
    color: "#e4e4e7",
    fontSize: 13,
    fontWeight: "600",
  },
  // Active Area
  activeContainer: {},
  mediaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  albumArt: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  albumArtPlaceholder: {
    width: 64,
    height: 64,
    backgroundColor: "#27272a",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  musicNote: {
    fontSize: 24,
  },
  mediaDetails: {
    flex: 1,
    gap: 2,
  },
  trackName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f4f4f5",
  },
  artistName: {
    fontSize: 13,
    color: "#a1a1aa",
  },
  albumName: {
    fontSize: 11,
    color: "#71717a",
  },
  sourceBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#1e3a8a",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  sourceText: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  playPauseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  playPauseButtonText: {
    color: "#fff",
    fontSize: 20,
  },
  // Volume Controls
  volumeContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
    paddingTop: 12,
  },
  volumeLabel: {
    fontSize: 13,
    color: "#a1a1aa",
    marginBottom: 8,
  },
  volumeControlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  volStepButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#27272a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  volStepText: {
    color: "#fafafa",
    fontSize: 18,
    fontWeight: "600",
  },
  volTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#27272a",
    borderRadius: 4,
    overflow: "hidden",
  },
  volFill: {
    height: "100%",
    backgroundColor: "#2563eb",
    borderRadius: 4,
  },
  mediaPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
