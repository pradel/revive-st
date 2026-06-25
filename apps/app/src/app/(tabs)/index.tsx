import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { Slider } from "@/components/ui/Slider";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import type { BoseSpeaker } from "@/features/speakers/hooks/useSpeakerManager";
import { PageHeader } from "@/ui/PageHeader";
import { PulseRing } from "@/ui/PulseRing";
import { COLORS } from "@/ui/theme";

export default function Index() {
  const router = useRouter();
  const { speakers, isScanning, rescan, volumeMutation } = useBose();
  const [localVolumes, setLocalVolumes] = useState<Record<string, number>>({});

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

  const showEmptyState = speakers.length === 0;
  const showSpeakers = speakers.length > 0;

  return (
    <ScrollView
      style={$container}
      contentContainerStyle={$content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isScanning}
          onRefresh={rescan}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* Header */}
      <PageHeader title="Revive ST" />

      {/* Unified Empty/Scanning State */}
      {showEmptyState && (
        <View style={$centerState}>
          <View style={$emptyIconContainer}>
            {isScanning && (
              <>
                <PulseRing delay={0} />
                <PulseRing delay={800} />
                <PulseRing delay={1600} />
              </>
            )}
            <SymbolView
              name={{
                ios: isScanning ? "waveform" : "speaker.wave.2",
                android: isScanning ? "graphic_eq" : "speaker",
                web: isScanning ? "graphic_eq" : "speaker",
              }}
              tintColor={isScanning ? COLORS.primary : COLORS.border}
              size={36}
            />
          </View>
          <Text style={$emptyTitle}>
            {isScanning ? "Searching for Speakers..." : "No Speakers Found"}
          </Text>
          <Text style={$emptyDescription}>
            {isScanning
              ? "Scanning your local network for active Bose SoundTouch speakers."
              : "Make sure your Bose SoundTouch speakers are powered on and connected to the same Wi-Fi network as your phone."}
          </Text>

          <View style={$emptyActions}>
            <Card
              style={[$ctaCard, isScanning && $ctaCardDisabled]}
              render={
                <TouchableOpacity
                  onPress={rescan}
                  activeOpacity={0.8}
                  disabled={isScanning}
                />
              }
            >
              <View style={$ctaIconContainer}>
                {isScanning ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <SymbolView
                    name={{
                      ios: "arrow.clockwise",
                      android: "refresh",
                      web: "refresh",
                    }}
                    tintColor={COLORS.primary}
                    size={20}
                  />
                )}
              </View>
              <View style={$ctaTextContainer}>
                <Text style={$ctaTitle}>Rescan Local Network</Text>
                <Text style={$ctaSubtitle}>
                  {isScanning
                    ? "Searching network..."
                    : "Search for active speakers on your current Wi-Fi connection."}
                </Text>
              </View>
              <SymbolView
                name={{
                  ios: "chevron.right",
                  android: "chevron_right",
                  web: "chevron_right",
                }}
                tintColor={COLORS.textDisabled}
                size={16}
              />
            </Card>

            <Card
              style={$ctaCard}
              render={
                <TouchableOpacity
                  onPress={() => {
                    router.push("/onboarding/permissions");
                  }}
                  activeOpacity={0.8}
                />
              }
            >
              <View style={$ctaIconContainer}>
                <SymbolView
                  name={{
                    ios: "plus",
                    android: "add",
                    web: "add",
                  }}
                  tintColor={COLORS.primary}
                  size={20}
                />
              </View>
              <View style={$ctaTextContainer}>
                <Text style={$ctaTitle}>Set Up New Speaker</Text>
                <Text style={$ctaSubtitle}>
                  Connect a new or reset SoundTouch speaker to your Wi-Fi
                  network.
                </Text>
              </View>
              <SymbolView
                name={{
                  ios: "chevron.right",
                  android: "chevron_right",
                  web: "chevron_right",
                }}
                tintColor={COLORS.textDisabled}
                size={16}
              />
            </Card>
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
                <Card key={speaker.deviceID}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      router.push(
                        `/speakers/${encodeURIComponent(speaker.deviceID)}/now-playing`,
                      );
                    }}
                  >
                    {/* Top row: name, link icon / online badge */}
                    <View style={$cardHeader}>
                      <Text style={$speakerName} numberOfLines={1}>
                        {speaker.name}
                      </Text>
                    </View>

                    {/* Middle row: Album Art & Track Info OR Fallback & Select Music */}
                    <View style={$cardContent}>
                      <View style={$albumCoverContainer}>
                        {speaker.artUrl ? (
                          <Image
                            source={{ uri: speaker.artUrl }}
                            style={$albumCoverImage}
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <SymbolView
                            name={{
                              ios: "music.note",
                              android: "music_note",
                              web: "music_note",
                            }}
                            tintColor={COLORS.textMuted}
                            size={24}
                          />
                        )}
                      </View>

                      <View style={$trackInfoContainer}>
                        {speaker.track || speaker.artUrl || status.active ? (
                          <>
                            <View style={$trackTitleRow}>
                              <Text style={$trackTitle} numberOfLines={1}>
                                {speaker.track ?? "Unknown Track"}
                              </Text>
                            </View>
                            <Text style={$trackSubtitle} numberOfLines={1}>
                              {speaker.artist
                                ? `${speaker.artist} - ${speaker.album ?? ""}`
                                : (speaker.album ?? "")}
                            </Text>
                          </>
                        ) : (
                          <Text style={$emptyTrackText}>No Music Selected</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Bottom row: Volume */}
                  <View style={$volumeRow}>
                    <SymbolView
                      name={{
                        ios: "speaker.fill",
                        android: "volume_down",
                        web: "volume_down",
                      }}
                      tintColor={COLORS.text}
                      size={16}
                    />
                    <View style={{ flex: 1, paddingHorizontal: 10 }}>
                      <Slider
                        value={volume}
                        minimumValue={0}
                        maximumValue={100}
                        onValueChange={(val) => {
                          setLocalVolumes((prev) => ({
                            ...prev,
                            [speaker.deviceID]: Math.round(val),
                          }));
                        }}
                        onSlidingComplete={(val) => {
                          setLocalVolumes((prev) => {
                            const { [speaker.deviceID]: _ignored, ...rest } =
                              prev;
                            return rest;
                          });
                          volumeMutation.mutate({
                            deviceID: speaker.deviceID,
                            volume: val,
                          });
                        }}
                      />
                    </View>
                    <Text style={$volumeText}>
                      {localVolumes[speaker.deviceID] ?? volume}
                    </Text>
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
                          ios: "gearshape",
                          android: "settings",
                          web: "settings",
                        }}
                        tintColor={COLORS.text}
                        size={20}
                      />
                    </TouchableOpacity>
                  </View>
                </Card>
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
              tintColor={COLORS.card}
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
  paddingTop: 60,
  paddingBottom: 40,
};

const $centerState: ViewStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: 80,
};

const $emptyIconContainer: ViewStyle = {
  width: 80,
  height: 80,
  borderRadius: 40,
  backgroundColor: COLORS.card,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 20,
  position: "relative",
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
  paddingHorizontal: 30,
};

const $emptyActions: ViewStyle = {
  gap: 12,
  width: "100%",
  paddingHorizontal: 20,
  marginTop: 8,
};

const $ctaCard: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  width: "100%",
};

const $ctaCardDisabled: ViewStyle = {
  opacity: 0.5,
};

const $ctaIconContainer: ViewStyle = {
  width: 40,
  height: 40,
  borderRadius: 12,
  backgroundColor: COLORS.primaryTransparent,
  alignItems: "center",
  justifyContent: "center",
  marginRight: 16,
};

const $ctaTextContainer: ViewStyle = {
  flex: 1,
  justifyContent: "center",
  marginRight: 8,
};

const $ctaTitle: TextStyle = {
  fontSize: 15,
  fontWeight: "600",
  color: COLORS.text,
  marginBottom: 2,
};

const $ctaSubtitle: TextStyle = {
  fontSize: 12,
  color: COLORS.textMuted,
  lineHeight: 16,
};

const $sectionHeader: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 14,
  paddingHorizontal: 20,
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
  paddingHorizontal: 20,
};

const $cardHeader: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
};

const $speakerName: TextStyle = {
  fontSize: 18,
  fontWeight: "700",
  color: COLORS.text,
  flex: 1,
};

const $cardContent: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 20,
};

const $albumCoverContainer: ViewStyle = {
  width: 60,
  height: 60,
  borderRadius: 8,
  backgroundColor: COLORS.border,
  alignItems: "center",
  justifyContent: "center",
  marginRight: 16,
  overflow: "hidden",
};

const $albumCoverImage: ImageStyle = {
  position: "absolute",
  width: "100%",
  height: "100%",
};

const $trackInfoContainer: ViewStyle = {
  flex: 1,
  justifyContent: "center",
};

const $trackTitleRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 4,
};

const $trackTitle: TextStyle = {
  fontSize: 16,
  fontWeight: "600",
  color: COLORS.text,
};

const $trackSubtitle: TextStyle = {
  fontSize: 14,
  color: COLORS.textMuted,
};

const $emptyTrackText: TextStyle = {
  fontSize: 14,
  fontWeight: "500",
  color: COLORS.text,
  marginBottom: 8,
};

const $volumeRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
};

const $volumeText: TextStyle = {
  fontSize: 14,
  color: COLORS.text,
  fontWeight: "500",
  width: 24,
  textAlign: "right",
};

const $settingsButton: ViewStyle = {
  padding: 4,
  marginLeft: 4,
};

const $addSpeakerButton: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  marginTop: 16,
  marginHorizontal: 20,
  paddingVertical: 14,
  borderRadius: 14,
  borderStyle: "dashed",
};

const $addSpeakerText: TextStyle = {
  fontSize: 14,
  color: COLORS.textDisabled,
  fontWeight: "600",
};
