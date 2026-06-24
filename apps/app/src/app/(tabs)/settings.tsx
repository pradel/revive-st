import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { APP_CONFIG } from "@/config";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import { useLogger } from "@/lib/useLogger";
import { Header } from "@/ui/Header";
import { COLORS } from "@/ui/theme";

const version = Constants.expoConfig?.version ?? "0.0.0";

export default function AppSettings() {
  const router = useRouter();
  const { logs } = useLogger();
  const { isScanning, rescan } = useBose();

  return (
    <SafeAreaView style={$container}>
      <Header />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={$content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={$sectionLabel}>About</Text>

        <Card style={$heroCard}>
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
        </Card>

        <Card
          style={$linkCard}
          render={
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                void Linking.openURL(APP_CONFIG.WEBSITE_URL);
              }}
            />
          }
        >
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
        </Card>

        <Card
          style={$linkCard}
          render={
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                void Linking.openURL(APP_CONFIG.GITHUB_URL);
              }}
            />
          }
        >
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
        </Card>

        <Text style={$sectionLabel}>Network</Text>
        <Card
          style={[$linkCard, isScanning && { opacity: 0.6 }]}
          render={
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={rescan}
              disabled={isScanning}
            />
          }
        >
          <View style={$linkIconContainer}>
            {isScanning ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <SymbolView
                name={{
                  ios: "arrow.clockwise",
                  android: "refresh",
                  web: "refresh",
                }}
                tintColor={COLORS.textSecondary}
                size={20}
              />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={$linkText}>Rescan Local Network</Text>
            <Text style={$linkSubText}>
              {isScanning
                ? "Scanning network..."
                : "Search for SoundTouch speakers"}
            </Text>
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
        </Card>

        <Text style={$sectionLabel}>Developer</Text>
        <Card
          style={$linkCard}
          render={
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                router.push("/logs");
              }}
            />
          }
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
        </Card>
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
