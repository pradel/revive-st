import { useLocalSearchParams, usePreventRemove, useRouter } from "expo-router";
import {
  type ComponentRef,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, View, type TextStyle, type ViewStyle } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { KeepAwake } from "@/components/KeepAwake";
import { isScenarioName } from "@/features/onboarding/adapters/simulated";
import { CredentialsForm } from "@/features/onboarding/components/CredentialsForm";
import { DoneView } from "@/features/onboarding/components/DoneView";
import { FailedView } from "@/features/onboarding/components/FailedView";
import { NameSpeakerView } from "@/features/onboarding/components/NameSpeakerView";
import {
  ChooseSpeakerView,
  ManualJoinView,
  RationaleView,
} from "@/features/onboarding/components/PromptViews";
import { SetupScrollContext } from "@/features/onboarding/components/SetupLayout";
import {
  SetupUnavailableView,
  SPEAKER_SETUP_SUPPORTED,
} from "@/features/onboarding/components/SetupUnavailable";
import { WorkingView } from "@/features/onboarding/components/WorkingView";
import type { ScenarioName } from "@/features/onboarding/session/testing/scenarios";
import type { Prompt, SetupView } from "@/features/onboarding/session/types";
import {
  type SetupSessionHandle,
  useSetupSession,
} from "@/features/onboarding/useSetupSession";
import { icons } from "@/ui/ds/Icon";
import { IconButton } from "@/ui/ds/IconButton";
import { Screen } from "@/ui/ds/Screen";
import { Text } from "@/ui/ds/Text";
import { space } from "@/ui/tokens";

type CredentialsPrompt = Extract<Prompt, { kind: "credentials" }>;

interface SetupContentProps {
  view: SetupView;
  session: SetupSessionHandle;
  /** Last credentials prompt, kept on screen while its networks are rescanned. */
  lastCredentials: CredentialsPrompt | undefined;
}

function SetupContent({ view, session, lastCredentials }: SetupContentProps) {
  const { respond } = session;
  const credentialsForm = (prompt: CredentialsPrompt, refreshing: boolean) => (
    <CredentialsForm
      networks={prompt.networks}
      suggested={prompt.suggested}
      reason={prompt.reason}
      refreshing={refreshing}
      onRefresh={() => {
        respond({ kind: "action", action: "retry" });
      }}
      onSubmit={(ssid, password) => {
        respond({ kind: "credentials", ssid, password });
      }}
    />
  );

  switch (view.kind) {
    case "working": {
      if (
        view.step === "credentials" &&
        view.detail.kind === "loadingNetworks" &&
        lastCredentials !== undefined
      ) {
        return credentialsForm(lastCredentials, true);
      }
      return (
        <WorkingView
          step={view.step}
          detail={view.detail}
          startedAt={view.startedAt}
          onEnableWifi={() => {
            respond({ kind: "action", action: "openWifiPanel" });
          }}
          onManualJoin={() => {
            respond({ kind: "action", action: "manualJoin" });
          }}
        />
      );
    }
    case "prompt": {
      const { prompt } = view;
      switch (prompt.kind) {
        case "rationale": {
          return (
            <RationaleView
              onContinue={() => {
                respond({ kind: "continue" });
              }}
            />
          );
        }
        case "chooseSpeaker": {
          return (
            <ChooseSpeakerView
              speakers={prompt.speakers}
              onChoose={(bssid) => {
                respond({ kind: "chooseSpeaker", bssid });
              }}
            />
          );
        }
        case "credentials": {
          return credentialsForm(prompt, false);
        }
        case "manualJoin": {
          return (
            <ManualJoinView
              onOpenSettings={() => {
                session.openWifiSettings();
              }}
              onConnected={() => {
                respond({ kind: "manualJoin", connected: true });
              }}
            />
          );
        }
        case "nameSpeaker": {
          return (
            <NameSpeakerView
              currentName={prompt.currentName}
              suggestions={prompt.suggestions}
              onSubmit={(name) => {
                respond({ kind: "name", name });
              }}
            />
          );
        }
        default: {
          return prompt satisfies never;
        }
      }
    }
    case "failed": {
      return (
        <FailedView
          error={view.error}
          actions={view.actions}
          onAction={(action) => {
            respond({ kind: "action", action });
          }}
          onEnterIp={(ip) => {
            respond({ kind: "enterIp", ip });
          }}
        />
      );
    }
    case "done": {
      return (
        <DoneView speaker={view.speaker} renameFailed={view.renameFailed} />
      );
    }
    default: {
      return view satisfies never;
    }
  }
}

/** Close button and scrolling content shared by the setup screens. */
function SetupChrome({
  scenario,
  children,
}: {
  scenario: ScenarioName | undefined;
  children: ReactNode;
}) {
  const router = useRouter();
  const scrollRef = useRef<ComponentRef<typeof KeyboardAwareScrollView>>(null);
  const scroll = useMemo(
    () => ({
      scrollToEnd: () => {
        scrollRef.current?.scrollToEnd({ animated: true });
      },
    }),
    [],
  );
  return (
    <Screen presentation="fullscreen">
      <View style={$topBar}>
        {scenario !== undefined && (
          <Text
            variant="caption"
            color="warning"
            style={$simulated}
            numberOfLines={1}
          >
            Simulated: {scenario}
          </Text>
        )}
        <IconButton
          icon={icons.close}
          accessibilityLabel="Close setup"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/");
            }
          }}
        />
      </View>
      <SetupScrollContext.Provider value={scroll}>
        <KeyboardAwareScrollView
          ref={scrollRef}
          contentContainerStyle={$content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          // Space kept below a focused field: room for the submit button under it.
          bottomOffset={120}
        >
          {children}
        </KeyboardAwareScrollView>
      </SetupScrollContext.Provider>
    </Screen>
  );
}

function SetupScreen({ scenario }: { scenario: ScenarioName | undefined }) {
  const session = useSetupSession(scenario);
  const { view } = session;
  const [leaving, setLeaving] = useState(false);
  const [lastCredentials, setLastCredentials] = useState<CredentialsPrompt>();

  useEffect(() => {
    if (view?.kind === "prompt" && view.prompt.kind === "credentials") {
      setLastCredentials(view.prompt);
    } else if (view?.kind === "working" && view.step !== "credentials") {
      // Credentials asked again after delivery (wrong password) start from a
      // fresh form, not from the one that was sent.
      setLastCredentials(undefined);
    }
  }, [view]);

  // Leaving mid-setup cancels the session, which releases the speaker's network.
  usePreventRemove(
    !leaving && view !== undefined && view.kind !== "done",
    ({ repeat }) => {
      Alert.alert(
        "Stop speaker setup?",
        "The speaker stays in setup mode, so you can start again later.",
        [
          { text: "Keep going", style: "cancel" },
          {
            text: "Stop setup",
            style: "destructive",
            onPress: () => {
              setLeaving(true);
              void session
                .cancel()
                .catch(() => undefined)
                .then(repeat);
            },
          },
        ],
      );
    },
  );

  return (
    <SetupChrome scenario={scenario}>
      {view?.kind === "working" && <KeepAwake />}
      {view !== undefined && (
        <SetupContent
          view={view}
          session={session}
          lastCredentials={lastCredentials}
        />
      )}
    </SetupChrome>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { simulate } = useLocalSearchParams<{ simulate?: string }>();
  const scenario =
    __DEV__ && simulate !== undefined && isScenarioName(simulate)
      ? simulate
      : undefined;

  // Simulated setup runs on fakes, so it stays available everywhere in dev builds.
  if (!SPEAKER_SETUP_SUPPORTED && scenario === undefined) {
    return (
      <SetupChrome scenario={undefined}>
        <SetupUnavailableView
          onClose={() => {
            router.dismissTo("/");
          }}
        />
      </SetupChrome>
    );
  }
  return <SetupScreen scenario={scenario} />;
}

const $topBar: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: space.sm,
  paddingLeft: space.screen,
  paddingRight: space.xs,
};

const $simulated: TextStyle = {
  flex: 1,
};

const $content: ViewStyle = {
  flexGrow: 1,
  paddingHorizontal: space.screen,
  paddingTop: space.md,
  paddingBottom: space.xxxl,
};
