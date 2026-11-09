import { FieldGroup, Text } from "@expo/ui";
import { useRouter } from "expo-router";
import { Alert, Linking } from "react-native";

import { APP_CONFIG } from "@/config";
import { simulatedConfigureScenarios } from "@/features/configure/simulated";
import { simulatedScenarios } from "@/features/onboarding/adapters/simulated";
import {
  HOME_PASSWORD,
  HOME_SSID,
} from "@/features/onboarding/session/testing/scenarios";
import { useServerUrl } from "@/features/server/server";
import { serverHost } from "@/features/server/server-url";
import { OFFLINE_SPEAKER_ACTIONS } from "@/features/speakers/components/offline-actions";
import { speakerStateLabel } from "@/features/speakers/lib/playback";
import {
  speakerRegistry,
  useSpeakers,
} from "@/features/speakers/registry/store";
import type { BoseSpeaker } from "@/features/speakers/registry/types";
import { appVersion } from "@/lib/app-version";
import { useLogger } from "@/lib/useLogger";
import { Screen } from "@/ui/ds/Screen";
import { Form } from "@/ui/form/Form";
import { formIcons } from "@/ui/form/icons";
import { FormFooterText, FormLinkRow, FormValueRow } from "@/ui/form/rows";
import { FormSection } from "@/ui/form/Section";
import { color } from "@/ui/tokens";

/** An offline speaker's settings can't be read: try it again or forget it. */
const askAboutOffline = (speaker: BoseSpeaker) => {
  Alert.alert(
    `${speaker.name} is offline`,
    "Make sure it's on and on the same Wi-Fi network as your phone. Forgetting it removes it from the list until a scan finds it again.",
    [
      { text: "Cancel", style: "cancel" },
      ...OFFLINE_SPEAKER_ACTIONS.map((action) => ({
        text: action.title,
        style: action.destructive ? ("destructive" as const) : undefined,
        onPress: () => {
          action.run(speaker.deviceID);
        },
      })),
    ],
  );
};

export default function AppSettings() {
  const router = useRouter();
  const { logs } = useLogger();
  const { scan, listed } = useSpeakers();
  const isScanning = scan !== null;
  const serverUrl = useServerUrl();

  return (
    <Screen>
      <Form>
        {listed.length > 0 ? (
          <FormSection title="Speakers">
            {listed.map((speaker) => (
              <FormLinkRow
                key={speaker.deviceID}
                icon={formIcons.speaker}
                label={speaker.name}
                description={`${speaker.type} · ${speakerStateLabel(speaker)}`}
                disabled={speaker.status === "connecting"}
                onPress={() => {
                  if (speaker.status === "offline") {
                    askAboutOffline(speaker);
                  } else {
                    router.push(
                      `/speakers/${encodeURIComponent(speaker.deviceID)}/settings`,
                    );
                  }
                }}
              />
            ))}
          </FormSection>
        ) : null}

        <FormSection title="About">
          <FormValueRow
            icon={formIcons.speaker}
            label="Revive ST"
            value={`Version ${appVersion}`}
          />
          <FormLinkRow
            icon={formIcons.changelog}
            label="What's new"
            onPress={() => {
              void Linking.openURL(APP_CONFIG.CHANGELOG_URL);
            }}
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
          <FormLinkRow
            icon={formIcons.privacy}
            label="Privacy policy"
            onPress={() => {
              void Linking.openURL(APP_CONFIG.PRIVACY_URL);
            }}
          />
          <FieldGroup.SectionFooter>
            <FormFooterText>
              Revive ST is not affiliated with or endorsed by Bose Corporation.
              Bose and SoundTouch are trademarks of Bose Corporation.
            </FormFooterText>
          </FieldGroup.SectionFooter>
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
