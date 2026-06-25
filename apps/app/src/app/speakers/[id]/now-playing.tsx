import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useRef } from "react";
import {
  Text,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type TextStyle,
  type ViewStyle,
  type ImageStyle,
} from "react-native";

import { useBose } from "@/features/speakers/contexts/BoseContext";
import { COLORS } from "@/ui/theme";

export default function NowPlayingModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { speakers, volumeMutation, playPauseMutation, keyMutation } =
    useBose();

  const speaker = speakers.find((s) => s.deviceID === id);
  const sliderLayoutsRef = useRef<number>(0);

  const handleVolumeTap = useCallback(
    (event: GestureResponderEvent) => {
      const trackWidth = sliderLayoutsRef.current;
      if (!trackWidth || !speaker) {
        return;
      }

      const locationX = event.nativeEvent.locationX;
      const volume = Math.round(
        Math.min(100, Math.max(0, (locationX / trackWidth) * 100)),
      );
      volumeMutation.mutate({ deviceID: speaker.deviceID, volume });
    },
    [speaker, volumeMutation],
  );

  const handleSliderLayout = useCallback((event: LayoutChangeEvent) => {
    sliderLayoutsRef.current = event.nativeEvent.layout.width;
  }, []);

  if (!speaker) {
    return (
      <View style={$container}>
        <Text style={{ color: COLORS.text }}>Speaker not found.</Text>
      </View>
    );
  }

  const isPlaying =
    speaker.playStatus === "PLAY_STATE" ||
    speaker.playStatus === "BUFFERING_STATE";
  const volume = speaker.volume ?? 0;

  const hasMusic = Boolean(
    speaker.track ?? speaker.artUrl ?? speaker.artist ?? isPlaying,
  );

  return (
    <View style={$container}>
      {/* Top Header */}
      <View style={$header}>
        <TouchableOpacity
          onPress={() => {
            router.back();
          }}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <SymbolView
            name={{
              ios: "chevron.down",
              android: "keyboard_arrow_down",
              web: "keyboard_arrow_down",
            }}
            tintColor={COLORS.text}
            size={24}
          />
        </TouchableOpacity>
        {speaker.source ? (
          <View style={$sourceContainer}>
            <Text style={$sourceText}>{speaker.source}</Text>
          </View>
        ) : null}
        <View style={{ width: 24 }} />
      </View>

      <View style={$content}>
        <View style={$albumContainer}>
          {hasMusic && speaker.artUrl ? (
            <Image
              source={{ uri: speaker.artUrl }}
              style={$albumArt}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <View style={$albumFallback}>
              <SymbolView
                name={{
                  ios: "music.note",
                  android: "music_note",
                  web: "music_note",
                }}
                tintColor={COLORS.textMuted}
                size={80}
              />
            </View>
          )}
        </View>

        <View style={$trackInfo}>
          {hasMusic ? (
            <>
              <Text style={$trackTitle} numberOfLines={1}>
                {speaker.track ?? "Unknown Track"}
              </Text>
              <Text style={$trackSubtitle} numberOfLines={1}>
                {speaker.artist
                  ? `${speaker.artist} ${speaker.album ? `• ${speaker.album}` : ""}`
                  : (speaker.album ?? "Unknown Artist")}
              </Text>
            </>
          ) : (
            <>
              <Text style={$trackTitle} numberOfLines={1}>
                No Music Selected
              </Text>
              <Text style={$trackSubtitle} numberOfLines={1}>
                Ready to play
              </Text>
            </>
          )}
        </View>

        <View style={$playbackControls}>
          <TouchableOpacity
            style={$controlButton}
            onPress={() => {
              keyMutation.mutate({
                deviceID: speaker.deviceID,
                key: "PREV_TRACK",
              });
            }}
            disabled={!hasMusic}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <SymbolView
              name={{
                ios: "backward.fill",
                android: "skip_previous",
                web: "skip_previous",
              }}
              tintColor={hasMusic ? COLORS.text : COLORS.border}
              size={32}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              $playPauseMutationButton,
              !hasMusic && { backgroundColor: COLORS.border },
            ]}
            onPress={() => {
              playPauseMutation.mutate({ deviceID: speaker.deviceID });
            }}
            disabled={!hasMusic}
          >
            <SymbolView
              name={{
                ios: isPlaying ? "pause.fill" : "play.fill",
                android: isPlaying ? "pause" : "play_arrow",
                web: isPlaying ? "pause" : "play_arrow",
              }}
              tintColor={hasMusic ? COLORS.background : COLORS.textMuted}
              size={36}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={$controlButton}
            onPress={() => {
              keyMutation.mutate({
                deviceID: speaker.deviceID,
                key: "NEXT_TRACK",
              });
            }}
            disabled={!hasMusic}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <SymbolView
              name={{
                ios: "forward.fill",
                android: "skip_next",
                web: "skip_next",
              }}
              tintColor={hasMusic ? COLORS.text : COLORS.border}
              size={32}
            />
          </TouchableOpacity>
        </View>

        <View style={$volumeRow}>
          <SymbolView
            name={{
              ios: "speaker.fill",
              android: "volume_down",
              web: "volume_down",
            }}
            tintColor={COLORS.text}
            size={18}
          />
          <TouchableOpacity
            style={$sliderTrack}
            activeOpacity={1}
            onPress={handleVolumeTap}
            onLayout={handleSliderLayout}
          >
            <View style={[$sliderFill, { width: `${volume}%` }]} />
            <View style={[$sliderThumb, { left: `${volume}%` }]} />
          </TouchableOpacity>
          <Text style={$volumeText}>{volume}</Text>
        </View>

        <View style={$actionsRow} />
      </View>
    </View>
  );
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: COLORS.background, // Should match dark background from design
};

const $header: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingHorizontal: 24,
  paddingTop: 16,
  paddingBottom: 8,
};

const $sourceContainer: ViewStyle = {
  flex: 1,
  alignItems: "center",
};

const $sourceText: TextStyle = {
  color: COLORS.success, // e.g. Spotify green, or generic text
  fontSize: 14,
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: 1,
};

const $content: ViewStyle = {
  flex: 1,
  paddingHorizontal: 24,
  justifyContent: "space-around", // distribute space evenly
  paddingBottom: 40,
};

const $albumContainer: ViewStyle = {
  width: "100%",
  aspectRatio: 1, // Make it square
  borderRadius: 12,
  overflow: "hidden",
  backgroundColor: COLORS.card,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.5,
  shadowRadius: 20,
  elevation: 10,
  alignItems: "center",
  justifyContent: "center",
  marginVertical: 24,
};

const $albumArt: ImageStyle = {
  width: "100%",
  height: "100%",
};

const $albumFallback: ViewStyle = {
  width: "100%",
  height: "100%",
  backgroundColor: COLORS.border,
  alignItems: "center",
  justifyContent: "center",
};

const $trackInfo: ViewStyle = {
  alignItems: "flex-start",
  marginBottom: 24,
};

const $trackTitle: TextStyle = {
  fontSize: 24,
  fontWeight: "bold",
  color: COLORS.text,
  marginBottom: 6,
};

const $trackSubtitle: TextStyle = {
  fontSize: 16,
  color: COLORS.textMuted,
};

const $playbackControls: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 32,
  marginBottom: 32,
};

const $controlButton: ViewStyle = {
  padding: 8,
};

const $playPauseMutationButton: ViewStyle = {
  width: 72,
  height: 72,
  borderRadius: 36,
  backgroundColor: COLORS.text,
  alignItems: "center",
  justifyContent: "center",
};

const $volumeRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 16,
  marginBottom: 24,
};

const $sliderTrack: ViewStyle = {
  flex: 1,
  height: 4,
  backgroundColor: COLORS.border,
  borderRadius: 2,
  position: "relative",
  overflow: "visible",
  justifyContent: "center",
};

const $sliderFill: ViewStyle = {
  height: 4,
  backgroundColor: COLORS.text,
  borderRadius: 2,
  position: "absolute",
  left: 0,
};

const $sliderThumb: ViewStyle = {
  position: "absolute",
  width: 14,
  height: 14,
  borderRadius: 7,
  backgroundColor: COLORS.text,
  marginLeft: -7,
};

const $volumeText: TextStyle = {
  fontSize: 14,
  color: COLORS.text,
  fontWeight: "500",
  width: 28,
  textAlign: "right",
};

const $actionsRow: ViewStyle = {
  height: 40,
  // Placeholder for future bottom actions (like devices button)
};
