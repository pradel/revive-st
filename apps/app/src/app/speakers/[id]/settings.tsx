import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useBose } from "@/features/speakers/contexts/BoseContext";

export default function SpeakerSettings() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { speakers } = useBose();

  const speaker = speakers.find((s) => s.deviceID === id);

  if (!speaker) {
    return (
      <View style={$container}>
        <Stack.Screen
          options={{
            title: "Settings",
            headerShown: true,
            headerStyle: { backgroundColor: "#09090b" },
            headerTintColor: "#fafafa",
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: "600" },
          }}
        />
        <View style={$centerState}>
          <ActivityIndicator size="small" color="#71717a" />
          <Text style={$notFoundText}>Speaker not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={$backButton}>
            <Text style={$backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isPlaying = speaker.playStatus === "PLAY_STATE";
  const isStandby = !speaker.playStatus || speaker.playStatus === "STANDBY";

  return (
    <ScrollView
      style={$container}
      contentContainerStyle={$content}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen
        options={{
          title: "Settings",
          headerShown: true,
          headerStyle: { backgroundColor: "#09090b" },
          headerTintColor: "#fafafa",
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "600" },
        }}
      />

      {/* Speaker Identity */}
      <View style={$card}>
        <View style={$cardHeader}>
          <View style={$speakerIcon}>
            <SymbolView
              name={{
                ios: "speaker.wave.2.fill",
                android: "volume_up",
                web: "volume_up",
              }}
              tintColor="#a1a1aa"
              size={24}
            />
          </View>
          <View style={$cardMeta}>
            <Text style={$speakerName}>{speaker.name}</Text>
            <Text style={$speakerType}>{speaker.type}</Text>
          </View>
        </View>
      </View>

      {/* Device Info */}
      <Text style={$sectionLabel}>Device Info</Text>
      <View style={$card}>
        <View style={$infoRow}>
          <Text style={$infoLabel}>Device ID</Text>
          <Text style={$infoValue} numberOfLines={1}>
            {speaker.deviceID}
          </Text>
        </View>
        <View style={$infoDivider} />
        <View style={$infoRow}>
          <Text style={$infoLabel}>IP Address</Text>
          <Text style={$infoValue}>{speaker.host}</Text>
        </View>
        <View style={$infoDivider} />
        <View style={$infoRow}>
          <Text style={$infoLabel}>Port</Text>
          <Text style={$infoValue}>{speaker.port}</Text>
        </View>
        <View style={$infoDivider} />
        <View style={$infoRow}>
          <Text style={$infoLabel}>Type</Text>
          <Text style={$infoValue}>{speaker.type}</Text>
        </View>
      </View>

      {/* Status */}
      <Text style={$sectionLabel}>Status</Text>
      <View style={$card}>
        <View style={$infoRow}>
          <Text style={$infoLabel}>Connection</Text>
          <View style={$statusBadge}>
            <View style={$onlineDot} />
            <Text style={$statusText}>Online</Text>
          </View>
        </View>
        <View style={$infoDivider} />
        <View style={$infoRow}>
          <Text style={$infoLabel}>Playback</Text>
          <View
            style={[
              $statusBadge,
              isPlaying
                ? $statusPlaying
                : isStandby
                  ? $statusStandby
                  : undefined,
            ]}
          >
            <View
              style={[
                $statusDot,
                isPlaying ? $dotPlaying : isStandby ? $dotStandby : undefined,
              ]}
            />
            <Text
              style={[
                $statusText,
                isPlaying
                  ? $statusTextPlaying
                  : isStandby
                    ? $statusTextStandby
                    : undefined,
              ]}
            >
              {isPlaying
                ? "Playing"
                : isStandby
                  ? "Standby"
                  : speaker.playStatus}
            </Text>
          </View>
        </View>
        {speaker.source && (
          <>
            <View style={$infoDivider} />
            <View style={$infoRow}>
              <Text style={$infoLabel}>Source</Text>
              <Text style={$infoValue}>{speaker.source}</Text>
            </View>
          </>
        )}
        {speaker.volume !== undefined && (
          <>
            <View style={$infoDivider} />
            <View style={$infoRow}>
              <Text style={$infoLabel}>Volume</Text>
              <Text style={$infoValue}>{speaker.volume}%</Text>
            </View>
          </>
        )}
        {speaker.muteEnabled !== undefined && (
          <>
            <View style={$infoDivider} />
            <View style={$infoRow}>
              <Text style={$infoLabel}>Muted</Text>
              <Text style={$infoValue}>
                {speaker.muteEnabled ? "Yes" : "No"}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Now Playing */}
      {isPlaying && (speaker.track || speaker.artist || speaker.album) && (
        <>
          <Text style={$sectionLabel}>Now Playing</Text>
          <View style={$card}>
            {speaker.track && (
              <View style={$infoRow}>
                <Text style={$infoLabel}>Track</Text>
                <Text style={$infoValue} numberOfLines={2}>
                  {speaker.track}
                </Text>
              </View>
            )}
            {speaker.artist && (
              <>
                <View style={$infoDivider} />
                <View style={$infoRow}>
                  <Text style={$infoLabel}>Artist</Text>
                  <Text style={$infoValue} numberOfLines={1}>
                    {speaker.artist}
                  </Text>
                </View>
              </>
            )}
            {speaker.album && (
              <>
                <View style={$infoDivider} />
                <View style={$infoRow}>
                  <Text style={$infoLabel}>Album</Text>
                  <Text style={$infoValue} numberOfLines={1}>
                    {speaker.album}
                  </Text>
                </View>
              </>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: "#09090b",
};

const $content: ViewStyle = {
  paddingHorizontal: 20,
  paddingTop: 8,
  paddingBottom: 40,
};

const $centerState: ViewStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: 80,
};

const $notFoundText: TextStyle = {
  fontSize: 16,
  color: "#71717a",
  marginTop: 16,
};

const $backButton: ViewStyle = {
  marginTop: 20,
  paddingHorizontal: 24,
  paddingVertical: 10,
  borderRadius: 10,
  backgroundColor: "#27272a",
};

const $backButtonText: TextStyle = {
  fontSize: 14,
  color: "#a1a1aa",
  fontWeight: "600",
};

const $card: ViewStyle = {
  backgroundColor: "#18181b",
  borderRadius: 16,
  padding: 16,
  borderWidth: 1,
  borderColor: "#27272a",
};

const $cardHeader: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
};

const $speakerIcon: ViewStyle = {
  width: 48,
  height: 48,
  borderRadius: 14,
  backgroundColor: "#27272a",
  alignItems: "center",
  justifyContent: "center",
  marginRight: 14,
};

const $cardMeta: ViewStyle = {
  flex: 1,
};

const $speakerName: TextStyle = {
  fontSize: 17,
  fontWeight: "700",
  color: "#fafafa",
};

const $speakerType: TextStyle = {
  fontSize: 13,
  color: "#52525b",
  marginTop: 2,
};

const $sectionLabel: TextStyle = {
  fontSize: 12,
  fontWeight: "700",
  color: "#52525b",
  letterSpacing: 1,
  textTransform: "uppercase",
  marginTop: 24,
  marginBottom: 8,
  marginLeft: 4,
};

const $infoRow: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingVertical: 4,
};

const $infoLabel: TextStyle = {
  fontSize: 14,
  color: "#71717a",
};

const $infoValue: TextStyle = {
  fontSize: 14,
  color: "#a1a1aa",
  fontWeight: "500",
  maxWidth: "55%",
  textAlign: "right",
};

const $infoDivider: ViewStyle = {
  height: 1,
  backgroundColor: "#27272a",
  marginVertical: 10,
};

const $statusBadge: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 5,
  backgroundColor: "#052e16",
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderRadius: 6,
};

const $statusDot: ViewStyle = {
  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: "#22c55e",
};

const $onlineDot: ViewStyle = {
  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: "#22c55e",
};

const $statusText: TextStyle = {
  fontSize: 11,
  color: "#4ade80",
  fontWeight: "700",
  letterSpacing: 0.3,
};

const $statusPlaying: ViewStyle = {
  backgroundColor: "#052e16",
};

const $statusStandby: ViewStyle = {
  backgroundColor: "#422006",
};

const $dotPlaying: ViewStyle = {
  backgroundColor: "#22c55e",
};

const $dotStandby: ViewStyle = {
  backgroundColor: "#f59e0b",
};

const $statusTextPlaying: TextStyle = {
  color: "#4ade80",
};

const $statusTextStandby: TextStyle = {
  color: "#fbbf24",
};
