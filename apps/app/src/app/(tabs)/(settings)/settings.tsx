import { FieldGroup, Text } from "@expo/ui";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Linking } from "react-native";

import { APP_CONFIG } from "@/config";
import { simulatedScenarios } from "@/features/onboarding/adapters/simulated";
import {
  HOME_PASSWORD,
  HOME_SSID,
} from "@/features/onboarding/session/testing/scenarios";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import { useLogger } from "@/lib/useLogger";
import { Screen } from "@/ui/ds/Screen";
import { Form } from "@/ui/form/Form";
import { formIcons } from "@/ui/form/icons";
import { FormLinkRow, FormValueRow } from "@/ui/form/rows";
import { FormSection } from "@/ui/form/Section";
import { color } from "@/ui/tokens";

const version = Constants.expoConfig?.version ?? "0.0.0";

export default function AppSettings() {
  const router = useRouter();
  const { logs } = useLogger();
  const { isScanning, rescan } = useBose();

  return (
    <Screen>
      <Form>
        <FormSection title="About">
          <FormValueRow
            icon={formIcons.speaker}
            label="Revive SoundTouch"
            value={`Version ${version}`}
          />
          <FormLinkRow
            icon={formIcons.website}
            label="Website"
            onPress={() => {
              void Linking.openURL(APP_CONFIG.WEBSITE_URL);
            }}
          />
          <FormLinkRow
            icon={formIcons.code}
            label="GitHub"
            onPress={() => {
              void Linking.openURL(APP_CONFIG.GITHUB_URL);
            }}
          />
        </FormSection>

        <FormSection title="Network">
          <FormLinkRow
            icon={formIcons.refresh}
            label="Rescan local network"
            description={
              isScanning
                ? "Scanning network…"
                : "Search for SoundTouch speakers"
            }
            disabled={isScanning}
            onPress={rescan}
          />
        </FormSection>

        <FormSection title="Developer">
          <FormLinkRow
            icon={formIcons.terminal}
            label="Logs"
            value={String(logs.length)}
            onPress={() => {
              router.push("/logs");
            }}
          />
        </FormSection>

        {/* Dev builds only: runs speaker setup against a fake scenario. */}
        {__DEV__ && (
          <FormSection title="Simulate speaker setup">
            {simulatedScenarios().map(({ name, description }) => (
              <FormLinkRow
                key={name}
                label={name}
                description={description}
                onPress={() => {
                  router.push({
                    pathname: "/onboarding",
                    params: { simulate: name },
                  });
                }}
              />
            ))}
            <FieldGroup.SectionFooter>
              <Text textStyle={{ color: color.textSecondary, fontSize: 13 }}>
                {`Fake speaker and phone; ${HOME_SSID} password: ${HOME_PASSWORD}`}
              </Text>
            </FieldGroup.SectionFooter>
          </FormSection>
        )}
      </Form>
    </Screen>
  );
}
