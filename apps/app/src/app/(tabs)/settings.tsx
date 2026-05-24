import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useLogger } from "@/lib/useLogger";
import { COLORS } from "@/ui/theme";

const version = Constants.expoConfig?.version ?? "0.0.0";

export default function AppSettings() {
  const router = useRouter();
  const { logs } = useLogger();

  return (
    <ScrollView
      style={$container}
      contentContainerStyle={$content}
      showsVerticalScrollIndicator={false}
    >
      {/* App Identity */}
      <View style={$card}>
        <View style={$cardHeader}>
          <View style={$appIcon}>
            <SymbolView
              name={{
                ios: "speaker.wave.2.fill",
                android: "speaker",
                web: "speaker",
              }}
              tintColor="#a1a1aa"
              size={24}
            />
          </View>
          <View style={$cardMeta}>
            <Text style={$appName}>Revive SoundTouch</Text>
            <Text style={$appType}>Bose Speaker Controller</Text>
          </View>
        </View>
      </View>

      {/* About */}
      <Text style={$sectionLabel}>About</Text>
      <View style={$card}>
        <View style={$infoRow}>
          <Text style={$infoLabel}>Version</Text>
          <Text style={$infoValue}>{version}</Text>
        </View>
      </View>

      {/* Developer */}
      <Text style={$sectionLabel}>Developer</Text>
      <View style={$card}>
        <TouchableOpacity
          style={$infoRow}
          activeOpacity={0.7}
          onPress={() => {
            router.push("/logs");
          }}
        >
          <Text style={$infoLabel}>Logs</Text>
          <View style={$infoRowRight}>
            <Text style={$infoValue}>{logs.length} entries</Text>
            <SymbolView
              name={{
                ios: "chevron.right",
                android: "chevron_right",
                web: "chevron_right",
              }}
              tintColor="#52525b"
              size={14}
            />
          </View>
        </TouchableOpacity>
      </View>
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

const $card: ViewStyle = {
  backgroundColor: COLORS.card,
  borderRadius: 16,
  padding: 16,
  borderWidth: 1,
  borderColor: COLORS.border,
};

const $cardHeader: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
};

const $appIcon: ViewStyle = {
  width: 48,
  height: 48,
  borderRadius: 14,
  backgroundColor: COLORS.border,
  alignItems: "center",
  justifyContent: "center",
  marginRight: 14,
};

const $cardMeta: ViewStyle = {
  flex: 1,
};

const $appName: TextStyle = {
  fontSize: 17,
  fontWeight: "700",
  color: COLORS.text,
};

const $appType: TextStyle = {
  fontSize: 13,
  color: COLORS.textDisabled,
  marginTop: 2,
};

const $sectionLabel: TextStyle = {
  fontSize: 12,
  fontWeight: "700",
  color: COLORS.textDisabled,
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
  color: COLORS.textMuted,
};

const $infoValue: TextStyle = {
  fontSize: 14,
  color: COLORS.textSecondary,
  fontWeight: "500",
};

const $infoRowRight: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
};
