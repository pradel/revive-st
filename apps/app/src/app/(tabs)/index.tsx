import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useRef } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useBose } from "@/features/speakers/contexts/BoseContext";
import type { BoseSpeaker } from "@/features/speakers/hooks/useBoseScanner";
import { COLORS } from "@/ui/theme";

export default function Index() {
  const router = useRouter();
  const { speakers, isScanning, rescan, changeVolume } = useBose();
  const sliderLayoutsRef = useRef<Record<string, number>>({});

  const handleVolumeTap = useCallback(
    (speaker: BoseSpeaker, event: GestureResponderEvent) => {
      const trackWidth = sliderLayoutsRef.current[speaker.deviceID];
      if (!trackWidth) {
        return;
      }
      const locationX = event.nativeEvent.locationX;
      const volume = Math.round(
        Math.min(100, Math.max(0, (locationX / trackWidth) * 100)),
      );
      void changeVolume(speaker.deviceID, volume);
    },
    [changeVolume],
  );

  const handleSliderLayout = useCallback(
    (deviceID: string, event: LayoutChangeEvent) => {
      sliderLayoutsRef.current[deviceID] = event.nativeEvent.layout.width;
    },
    [],
  );

  const getPlayingStatus = (speaker: BoseSpeaker) => {
    if (!speaker.playStatus || speaker.playStatus === "STANDBY") {
      return { label: "Standby", active: false };
    }
    switch (speaker.playStatus) {
      case "PLAY_STATE":
        return { label: "Playing", active: true };
      case "PAUSE_STATE":
        return { label: "Paused", active: false };
      case "STOP_STATE":
        return { label: "Stopped", active: false };
      case "BUFFERING_STATE":
        return { label: "Buffering", active: true };
      default:
        return { label: speaker.playStatus, active: false };
    }
  };

  const navigateToSettings = (speaker: BoseSpeaker) => {
    router.push(`/speakers/${encodeURIComponent(speaker.deviceID)}/settings`);
  };

  const showEmptyState = speakers.length === 0 && !isScanning;
  const showLoading = isScanning && speakers.length === 0;
  const showSpeakers = speakers.length > 0;

  return (
    <ScrollView
      style={$container}
      contentContainerStyle={$content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={$header}>
        <View>
          <Text style={$appSubtitle}>Revive</Text>
          <Text style={$appTitle}>SoundTouch</Text>
        </View>
        <TouchableOpacity
          style={$rescanButton}
          onPress={rescan}
          activeOpacity={0.7}
          disabled={isScanning}
        >
          {isScanning ? (
            <ActivityIndicator size="small" color="#a1a1aa" />
          ) : (
            <SymbolView
              name={{
                ios: "arrow.clockwise",
                android: "refresh",
                web: "refresh",
              }}
              tintColor="#a1a1aa"
              size={18}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Loading State */}
      {showLoading && (
        <View style={$centerState}>
          <ActivityIndicator size="large" color="#a1a1aa" />
          <Text style={$loadingText}>Scanning for speakers...</Text>
        </View>
      )}

      {/* Empty State */}
      {showEmptyState && (
        <View style={$centerState}>
          <View style={$emptyIconContainer}>
            <SymbolView
              name={{
                ios: "speaker.wave.2",
              }}
              tintColor="#52525b"
              size={48}
            />
          </View>
          <Text style={$emptyTitle}>No Speaker Phones</Text>
          <Text style={$emptyDescription}>
            Make sure your phone and SoundTouch{"\n"}speakers are connected to
            the same Wi-Fi network.
          </Text>
          <View style={$emptyActions}>
            <TouchableOpacity
              style={$primaryButton}
              onPress={rescan}
              activeOpacity={0.8}
            >
              <SymbolView
                name={{
                  ios: "arrow.clockwise",
                  android: "refresh",
                  web: "refresh",
                }}
                tintColor="#ffffff"
                size={16}
              />
              <Text style={$primaryButtonText}>Rescan Network</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={$secondaryButton}
              onPress={() => {
                router.push("/onboarding/permissions");
              }}
              activeOpacity={0.8}
            >
              <SymbolView
                name={{
                  ios: "plus",
                  android: "add",
                  web: "add",
                }}
                tintColor="#a1a1aa"
                size={18}
              />
              <Text style={$secondaryButtonText}>Add Speaker</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Speaker List */}
      {showSpeakers && (
        <>
          <View style={$sectionHeader}>
            <Text style={$sectionTitle}>Speakers on Network</Text>
            <Text style={$sectionCount}>{speakers.length} found</Text>
          </View>

          <View style={$speakersList}>
            {speakers.map((speaker) => {
              const status = getPlayingStatus(speaker);
              const volume = speaker.volume ?? 0;

              return (
                <View key={speaker.deviceID} style={$speakerCard}>
                  {/* Top row: icon, name, type, online badge, settings */}
                  <View style={$cardTopRow}>
                    <View style={$cardTopLeft}>
                      <View style={$speakerIcon}>
                        <SymbolView
                          name={{
                            ios: "speaker.wave.2.fill",
                            android: "speaker",
                            web: "speaker",
                          }}
                          tintColor="#a1a1aa"
                          size={20}
                        />
                      </View>
                      <View style={$cardMeta}>
                        <Text style={$speakerName} numberOfLines={1}>
                          {speaker.name}
                        </Text>
                        <Text style={$speakerType}>
                          {speaker.type} · {speaker.host}
                        </Text>
                      </View>
                    </View>

                    <View style={$cardTopRight}>
                      <View style={$onlineBadge}>
                        <View style={$onlineDot} />
                        <Text style={$onlineText}>Online</Text>
                      </View>
                      <TouchableOpacity
                        style={$settingsButton}
                        onPress={() => {
                          navigateToSettings(speaker);
                        }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <SymbolView
                          name={{
                            ios: "gearshape.fill",
                            android: "settings",
                            web: "settings",
                          }}
                          tintColor="#71717a"
                          size={16}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Divider */}
                  <View style={$cardDivider} />

                  {/* Playing status */}
                  <View style={$playingRow}>
                    <View
                      style={[
                        $playingDot,
                        status.active ? $playingDotActive : $playingDotInactive,
                      ]}
                    />
                    <Text style={$playingStatusText}>
                      {status.active || status.label === "Paused"
                        ? status.label +
                          (speaker.track
                            ? ` · ${speaker.track}${speaker.artist ? ` — ${speaker.artist}` : ""}`
                            : "")
                        : status.label}
                    </Text>
                  </View>

                  {/* Volume slider */}
                  <View style={$volumeRow}>
                    <SymbolView
                      name={{
                        ios: "speaker.fill",
                        android: "volume_down",
                        web: "volume_down",
                      }}
                      tintColor="#52525b"
                      size={14}
                    />
                    <TouchableOpacity
                      style={$sliderTrack}
                      activeOpacity={1}
                      onPress={(event) => {
                        handleVolumeTap(speaker, event);
                      }}
                      onLayout={(event) => {
                        handleSliderLayout(speaker.deviceID, event);
                      }}
                    >
                      <View style={[$sliderFill, { width: `${volume}%` }]} />
                      <View style={[$sliderThumb, { left: `${volume}%` }]} />
                    </TouchableOpacity>
                    <SymbolView
                      name={{
                        ios: "speaker.wave.3.fill",
                        android: "volume_up",
                        web: "volume_up",
                      }}
                      tintColor="#a1a1aa"
                      size={14}
                    />
                    <Text style={$volumeText}>{volume}%</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Add New Speaker Button */}
          <TouchableOpacity
            style={$addSpeakerButton}
            onPress={() => {
              router.push("/onboarding/permissions");
            }}
            activeOpacity={0.8}
          >
            <SymbolView
              name={{
                ios: "plus.circle.fill",
                android: "add_circle",
                web: "add_circle",
              }}
              tintColor="#3f3f46"
              size={22}
            />
            <Text style={$addSpeakerText}>Add New Speaker</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: COLORS.background,
};

const $content: ViewStyle = {
  paddingHorizontal: 20,
  paddingTop: 60,
  paddingBottom: 40,
};

const $header: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 28,
};

const $appSubtitle: TextStyle = {
  fontSize: 14,
  color: COLORS.textMuted,
  fontWeight: "500",
  letterSpacing: 0.5,
};

const $appTitle: TextStyle = {
  fontSize: 28,
  color: COLORS.text,
  fontWeight: "800",
  letterSpacing: -0.5,
  marginTop: 2,
};

const $rescanButton: ViewStyle = {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: COLORS.card,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: COLORS.border,
};

const $centerState: ViewStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: 80,
};

const $loadingText: TextStyle = {
  fontSize: 14,
  color: COLORS.textMuted,
  marginTop: 16,
};

const $emptyIconContainer: ViewStyle = {
  width: 96,
  height: 96,
  borderRadius: 48,
  backgroundColor: COLORS.card,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 24,
  borderWidth: 1,
  borderColor: COLORS.border,
};

const $emptyTitle: TextStyle = {
  fontSize: 22,
  color: COLORS.text,
  fontWeight: "700",
  letterSpacing: -0.3,
  marginBottom: 10,
};

const $emptyDescription: TextStyle = {
  fontSize: 14,
  color: COLORS.textMuted,
  textAlign: "center",
  lineHeight: 20,
  marginBottom: 32,
};

const $emptyActions: ViewStyle = {
  gap: 12,
  width: "100%",
  paddingHorizontal: 20,
};

const $primaryButton: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  backgroundColor: COLORS.text,
  height: 48,
  borderRadius: 14,
};

const $primaryButtonText: TextStyle = {
  fontSize: 15,
  color: COLORS.background,
  fontWeight: "600",
};

const $secondaryButton: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  backgroundColor: COLORS.card,
  height: 48,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: COLORS.border,
};

const $secondaryButtonText: TextStyle = {
  fontSize: 15,
  color: COLORS.textSecondary,
  fontWeight: "600",
};

const $sectionHeader: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 14,
};

const $sectionTitle: TextStyle = {
  fontSize: 14,
  fontWeight: "600",
  color: COLORS.textMuted,
  letterSpacing: 0.5,
  textTransform: "uppercase",
};

const $sectionCount: TextStyle = {
  fontSize: 13,
  color: COLORS.textDisabled,
  fontWeight: "500",
};

const $speakersList: ViewStyle = {
  gap: 10,
};

const $speakerCard: ViewStyle = {
  backgroundColor: COLORS.card,
  borderRadius: 18,
  padding: 16,
  borderWidth: 1,
  borderColor: COLORS.border,
};

const $cardTopRow: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const $cardTopLeft: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  flex: 1,
};

const $speakerIcon: ViewStyle = {
  width: 40,
  height: 40,
  borderRadius: 12,
  backgroundColor: COLORS.border,
  alignItems: "center",
  justifyContent: "center",
  marginRight: 12,
};

const $cardMeta: ViewStyle = {
  flex: 1,
};

const $speakerName: TextStyle = {
  fontSize: 15,
  fontWeight: "600",
  color: COLORS.text,
};

const $speakerType: TextStyle = {
  fontSize: 12,
  color: COLORS.textDisabled,
  marginTop: 2,
};

const $cardTopRight: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
};

const $onlineBadge: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 5,
  backgroundColor: COLORS.successDark,
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderRadius: 6,
};

const $onlineDot: ViewStyle = {
  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: COLORS.success,
};

const $onlineText: TextStyle = {
  fontSize: 10,
  color: COLORS.successLight,
  fontWeight: "700",
  letterSpacing: 0.3,
};

const $settingsButton: ViewStyle = {
  width: 32,
  height: 32,
  borderRadius: 10,
  backgroundColor: COLORS.border,
  alignItems: "center",
  justifyContent: "center",
};

const $cardDivider: ViewStyle = {
  height: 1,
  backgroundColor: COLORS.border,
  marginVertical: 12,
};

const $playingRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 14,
};

const $playingDot: ViewStyle = {
  width: 7,
  height: 7,
  borderRadius: 4,
  marginRight: 8,
};

const $playingDotActive: ViewStyle = {
  backgroundColor: COLORS.success,
};

const $playingDotInactive: ViewStyle = {
  backgroundColor: COLORS.warningDark,
};

const $playingStatusText: TextStyle = {
  fontSize: 13,
  color: COLORS.textSecondary,
  fontWeight: "500",
  flex: 1,
};

const $volumeRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
};

const $sliderTrack: ViewStyle = {
  flex: 1,
  height: 4,
  backgroundColor: COLORS.border,
  borderRadius: 2,
  position: "relative",
  overflow: "visible",
};

const $sliderFill: ViewStyle = {
  height: "100%",
  backgroundColor: COLORS.text,
  borderRadius: 2,
};

const $sliderThumb: ViewStyle = {
  position: "absolute",
  top: -5,
  width: 14,
  height: 14,
  borderRadius: 7,
  backgroundColor: COLORS.text,
  marginLeft: -7,
};

const $volumeText: TextStyle = {
  fontSize: 12,
  color: COLORS.textDisabled,
  fontWeight: "600",
  width: 32,
  textAlign: "right",
};

const $addSpeakerButton: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  marginTop: 16,
  paddingVertical: 14,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderStyle: "dashed",
};

const $addSpeakerText: TextStyle = {
  fontSize: 14,
  color: COLORS.textDisabled,
  fontWeight: "600",
};
