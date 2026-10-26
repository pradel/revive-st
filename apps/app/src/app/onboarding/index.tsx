import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, usePreventRemove, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  Alert,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { isScenarioName } from "@/features/onboarding/adapters/simulated";
import { CredentialsForm } from "@/features/onboarding/components/CredentialsForm";
import { DoneView } from "@/features/onboarding/components/DoneView";
import { FailedView } from "@/features/onboarding/components/FailedView";
import {
  ChooseSpeakerView,
  ManualJoinView,
  RationaleView,
} from "@/features/onboarding/components/PromptViews";
import { WorkingView } from "@/features/onboarding/components/WorkingView";
import type { Prompt, SetupView } from "@/features/onboarding/session/types";
import {
  type SetupSessionHandle,
  useSetupSession,
} from "@/features/onboarding/useSetupSession";
import { COLORS } from "@/ui/theme";

type CredentialsPrompt = Extract<Prompt, { kind: "credentials" }>;

/** Keeps the screen on while mounted (the session is working). */
function KeepAwake() {
  useKeepAwake();
  return null;
}

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
      return <DoneView speaker={view.speaker} host={view.host} />;
    }
    default: {
      return view satisfies never;
    }
  }
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { simulate } = useLocalSearchParams<{ simulate?: string }>();
  const scenario =
    __DEV__ && simulate !== undefined && isScenarioName(simulate)
      ? simulate
      : undefined;
  const session = useSetupSession(scenario);
  const { view } = session;
  const [leaving, setLeaving] = useState(false);
  const [lastCredentials, setLastCredentials] = useState<CredentialsPrompt>();

  useEffect(() => {
    if (view?.kind === "prompt" && view.prompt.kind === "credentials") {
      setLastCredentials(view.prompt);
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
    <SafeAreaView style={$container}>
      {view?.kind === "working" && <KeepAwake />}
      <View style={$topBar}>
        {scenario !== undefined && (
          <Text style={$simulated} numberOfLines={1}>
            Simulated: {scenario}
          </Text>
        )}
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/");
            }
          }}
          style={$closeButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Close setup"
        >
          <SymbolView
            name={{ ios: "xmark", android: "close", web: "close" }}
            tintColor={COLORS.textSecondary}
            size={22}
          />
        </TouchableOpacity>
      </View>
      <KeyboardAwareScrollView
        contentContainerStyle={$content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={40}
      >
        {view !== undefined && (
          <SetupContent
            view={view}
            session={session}
            lastCredentials={lastCredentials}
          />
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: COLORS.background,
};

const $topBar: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 12,
  paddingHorizontal: 16,
  paddingTop: 8,
};

const $simulated: TextStyle = {
  flex: 1,
  color: COLORS.warning,
  fontSize: 12,
  fontWeight: "600",
};

const $closeButton: ViewStyle = {
  padding: 8,
};

const $content: ViewStyle = {
  flexGrow: 1,
  paddingHorizontal: 24,
  paddingTop: 24,
  paddingBottom: 40,
};
