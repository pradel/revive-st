import { FieldGroup, Text } from "@expo/ui";
import { useRouter } from "expo-router";
import { Linking } from "react-native";

import { APP_CONFIG } from "@/config";
import { simulatedConfigureScenarios } from "@/features/configure/simulated";
import { simulatedScenarios } from "@/features/onboarding/adapters/simulated";
import {
  HOME_PASSWORD,
  HOME_SSID,
} from "@/features/onboarding/session/testing/scenarios";
import { useServerUrl } from "@/features/server/server";
import { serverHost } from "@/features/server/server-url";
import {
  speakerRegistry,
  useSpeakers,
} from "@/features/speakers/registry/store";
import { appVersion } from "@/lib/app-version";
import { useLogger } from "@/lib/useLogger";
import { Screen } from "@/ui/ds/Screen";
import { Form } from "@/ui/form/Form";
import { formIcons } from "@/ui/form/icons";
import { FormLinkRow, FormValueRow } from "@/ui/form/rows";
import { FormSection } from "@/ui/form/Section";
import { color } from "@/ui/tokens";

export default function AppSettings() {
  const router = useRouter();
  const { logs } = useLogger();
  const isScanning = useSpeakers().scan !== null;
  const serverUrl = useServerUrl();

  return (
    <Screen>
      <Form>
        <FormSection title="About">
          <FormValueRow
            icon={formIcons.speaker}
            label="Revive SoundTouch"
            value={`Version ${appVersion}`}
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
          <FormLinkRow
            icon={formIcons.feedback}
            label="Send feedback"
            onPress={() => {
              void Linking.openURL(APP_CONFIG.FEEDBACK_URL);
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
            onPress={() => {
              speakerRegistry.rescan();
            }}
          />
          <FormLinkRow
            icon={formIcons.server}
            label="Server"
            description={serverHost(serverUrl)}
            onPress={() => {
              router.push("/server");
            }}
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

        {/* Dev builds only: runs internet radio setup against a fake scenario. */}
        {__DEV__ && (
          <FormSection title="Simulate internet radio setup">
            {simulatedConfigureScenarios().map(({ name, description }) => (
              <FormLinkRow
                key={name}
                label={name}
                description={description}
                onPress={() => {
                  router.push({
                    pathname: "/speakers/[id]/configure",
                    params: { id: `simulated-${name}`, simulate: name },
                  });
                }}
              />
            ))}
          </FormSection>
        )}
      </Form>
    </Screen>
  );
}
