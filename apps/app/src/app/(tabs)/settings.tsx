import Constants from "expo-constants";
import { SymbolView } from "expo-symbols";
import {
  ScrollView,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

const version = Constants.expoConfig?.version ?? "0.0.0";

export default function AppSettings() {
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
    </ScrollView>
  );
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: "#09090b",
};

const $content: ViewStyle = {
  paddingHorizontal: 20,
  paddingTop: 60,
  paddingBottom: 40,
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

const $appIcon: ViewStyle = {
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

const $appName: TextStyle = {
  fontSize: 17,
  fontWeight: "700",
  color: "#fafafa",
};

const $appType: TextStyle = {
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
};
