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
import { SafeAreaView } from "react-native-safe-area-context";

import { useLogger } from "@/lib/useLogger";
import { Header } from "@/ui/Header";
import { COLORS } from "@/ui/theme";

const version = Constants.expoConfig?.version ?? "0.0.0";

export default function AppSettings() {
  const router = useRouter();
  const { logs } = useLogger();

  return (
    <SafeAreaView style={$container}>
      <Header />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={$content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={$sectionLabel}>About</Text>

        <View style={[$card, $heroCard]}>
          <View style={$heroIconContainer}>
            <SymbolView
              name={{
                ios: "speaker.wave.2",
                android: "speaker",
                web: "speaker",
              }}
              tintColor={COLORS.primary}
              size={32}
            />
          </View>
          <Text style={$heroTitle}>Revive SoundTouch</Text>
          <Text style={$heroSubtitle}>Version {version}</Text>
        </View>

        <TouchableOpacity style={$linkCard} activeOpacity={0.7}>
          <View style={$linkIconContainer}>
            <SymbolView
              name={{ ios: "globe", android: "language", web: "language" }}
              tintColor={COLORS.textSecondary}
              size={20}
            />
          </View>
          <Text style={[$linkText, { flex: 1 }]}>Website</Text>
          <SymbolView
            name={{
              ios: "chevron.right",
              android: "chevron_right",
              web: "chevron_right",
            }}
            tintColor={COLORS.textMuted}
            size={20}
          />
        </TouchableOpacity>

        <TouchableOpacity style={$linkCard} activeOpacity={0.7}>
          <View style={$linkIconContainer}>
            <SymbolView
              name={{
                ios: "chevron.left.forwardslash.chevron.right",
                android: "code",
                web: "code",
              }}
              tintColor={COLORS.textSecondary}
              size={20}
            />
          </View>
          <Text style={[$linkText, { flex: 1 }]}>GitHub</Text>
          <SymbolView
            name={{
              ios: "chevron.right",
              android: "chevron_right",
              web: "chevron_right",
            }}
            tintColor={COLORS.textMuted}
            size={20}
          />
        </TouchableOpacity>

        <Text style={$sectionLabel}>Developer</Text>
        <TouchableOpacity
          style={$linkCard}
          activeOpacity={0.7}
          onPress={() => {
            router.push("/logs");
          }}
        >
          <View style={$linkIconContainer}>
            <SymbolView
              name={{ ios: "terminal", android: "terminal", web: "terminal" }}
              tintColor={COLORS.textSecondary}
              size={20}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={$linkText}>Logs</Text>
            <Text style={$linkSubText}>{logs.length} entries stored</Text>
          </View>
          <SymbolView
            name={{
              ios: "chevron.right",
              android: "chevron_right",
              web: "chevron_right",
            }}
            tintColor={COLORS.textMuted}
            size={20}
          />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: COLORS.background,
};

const $content: ViewStyle = {
  paddingHorizontal: 20,
  paddingBottom: 40,
  gap: 12,
};

const $card: ViewStyle = {
  backgroundColor: COLORS.card,
  borderRadius: 16,
  padding: 16,
  borderWidth: 1,
  borderColor: COLORS.border,
};

const $heroCard: ViewStyle = {
  alignItems: "center",
  paddingVertical: 32,
  marginBottom: 8,
};

const $heroIconContainer: ViewStyle = {
  width: 64,
  height: 64,
  borderRadius: 32,
  backgroundColor: "rgba(29, 185, 84, 0.1)",
  justifyContent: "center",
  alignItems: "center",
  marginBottom: 16,
};

const $heroTitle: TextStyle = {
  fontSize: 22,
  fontWeight: "bold",
  color: COLORS.text,
  marginBottom: 4,
};

const $heroSubtitle: TextStyle = {
  fontSize: 14,
  color: COLORS.textMuted,
};

const $sectionLabel: TextStyle = {
  fontSize: 16,
  fontWeight: "700",
  color: COLORS.primary,
  marginTop: 16,
  marginBottom: 4,
  marginLeft: 4,
};

const $linkCard: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: COLORS.card,
  borderRadius: 16,
  padding: 16,
  borderWidth: 1,
  borderColor: COLORS.border,
};

const $linkIconContainer: ViewStyle = {
  width: 36,
  height: 36,
  borderRadius: 8,
  backgroundColor: "rgba(255, 255, 255, 0.05)",
  justifyContent: "center",
  alignItems: "center",
  marginRight: 16,
};

const $linkText: TextStyle = {
  fontSize: 15,
  color: COLORS.text,
  fontWeight: "500",
};

const $linkSubText: TextStyle = {
  fontSize: 12,
  color: COLORS.textMuted,
  marginTop: 2,
};
