import Constants from "expo-constants";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";

import { APP_CONFIG } from "@/config";
import { SimulateSetupCard } from "@/features/onboarding/components/SimulateSetupCard";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import { useLogger } from "@/lib/useLogger";
import { Icon, icons, type IconName } from "@/ui/ds/Icon";
import { ListRow } from "@/ui/ds/ListRow";
import { Screen } from "@/ui/ds/Screen";
import { SectionHeader } from "@/ui/ds/SectionHeader";
import { color, radius, space } from "@/ui/tokens";

const version = Constants.expoConfig?.version ?? "0.0.0";

const chevron = (
  <Icon name={icons.chevronRight} size={16} color="textTertiary" />
);

export default function AppSettings() {
  const router = useRouter();
  const { logs } = useLogger();
  const { isScanning, rescan } = useBose();

  return (
    <Screen title="Settings">
      <ScrollView
        contentContainerStyle={$content}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader title="About" />
        <ListRow
          title="Revive SoundTouch"
          subtitle={`Version ${version}`}
          leading={<RowIcon name={icons.speaker} />}
        />
        <ListRow
          title="Website"
          leading={
            <RowIcon
              name={{ ios: "globe", android: "language", web: "language" }}
            />
          }
          trailing={chevron}
          onPress={() => {
            void Linking.openURL(APP_CONFIG.WEBSITE_URL);
          }}
        />
        <ListRow
          title="GitHub"
          leading={
            <RowIcon
              name={{
                ios: "chevron.left.forwardslash.chevron.right",
                android: "code",
                web: "code",
              }}
            />
          }
          trailing={chevron}
          onPress={() => {
            void Linking.openURL(APP_CONFIG.GITHUB_URL);
          }}
        />

        <SectionHeader title="Network" />
        <ListRow
          title="Rescan local network"
          subtitle={
            isScanning ? "Scanning network…" : "Search for SoundTouch speakers"
          }
          leading={
            <View style={$iconWell}>
              {isScanning ? (
                <ActivityIndicator size="small" color={color.textSecondary} />
              ) : (
                <Icon name={icons.refresh} />
              )}
            </View>
          }
          trailing={chevron}
          onPress={rescan}
          disabled={isScanning}
        />

        <SectionHeader title="Developer" />
        <ListRow
          title="Logs"
          subtitle={`${logs.length} entries stored`}
          leading={
            <RowIcon
              name={{ ios: "terminal", android: "terminal", web: "terminal" }}
            />
          }
          trailing={chevron}
          onPress={() => {
            router.push("/logs");
          }}
        />
        {__DEV__ && (
          <View style={$devSlot}>
            <SimulateSetupCard />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function RowIcon({ name }: { name: IconName }) {
  return (
    <View style={$iconWell}>
      <Icon name={name} />
    </View>
  );
}

const $content: ViewStyle = {
  paddingBottom: space.xxl,
};

const $iconWell: ViewStyle = {
  width: 40,
  height: 40,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: radius.sm,
  backgroundColor: color.surface1,
};

const $devSlot: ViewStyle = {
  paddingHorizontal: space.screen,
};
