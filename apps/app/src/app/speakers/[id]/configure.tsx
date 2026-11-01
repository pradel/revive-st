import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ScrollView, type TextStyle, type ViewStyle } from "react-native";

import { KeepAwake } from "@/components/KeepAwake";
import {
  DoneView,
  FailedView,
  IntroView,
  WorkingView,
} from "@/features/configure/components/ConfigureViews";
import type { ConfigureView } from "@/features/configure/session/types";
import {
  isConfigureScenarioName,
  simulatedSpeakerName,
} from "@/features/configure/simulated";
import {
  endConfigure,
  startConfigure,
  useConfigureRun,
} from "@/features/configure/store";
import { useServerUrl } from "@/features/server/server";
import { serverHost } from "@/features/server/server-url";
import { useRadioSetupQuery } from "@/features/speakers/hooks/useRadioSetupQuery";
import { useSpeakers } from "@/features/speakers/registry/store";
import { haptics } from "@/lib/haptics";
import { Button } from "@/ui/ds/Button";
import { EmptyState } from "@/ui/ds/EmptyState";
import { icons } from "@/ui/ds/Icon";
import { Screen } from "@/ui/ds/Screen";
import { Text } from "@/ui/ds/Text";
import { space } from "@/ui/tokens";

/** Haptics, once per finished run seen on screen. */
function useOutcomeEffects(view: ConfigureView | undefined) {
  const previous = useRef(view);
  useEffect(() => {
    const before = previous.current;
    previous.current = view;
    if (view === undefined || before === view || before?.kind !== "working") {
      return;
    }
    if (view.kind === "done") {
      haptics.success();
    } else if (view.kind === "failed") {
      haptics.error();
    }
  }, [view]);
}

export default function ConfigureSpeaker() {
  const router = useRouter();
  const { id, simulate } = useLocalSearchParams<{
    id: string;
    simulate?: string;
  }>();
  const scenario =
    __DEV__ && simulate !== undefined && isConfigureScenarioName(simulate)
      ? simulate
      : undefined;
  const { online: speakers } = useSpeakers();
  const speaker = speakers.find((item) => item.deviceID === id);
  const { run, view } = useConfigureRun(id);
  const host = serverHost(useServerUrl());
  const radioSetup = useRadioSetupQuery(speaker?.host ?? "");
  useOutcomeEffects(view);

  const close = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const speakerName =
    run?.target.name ??
    speaker?.name ??
    (scenario === undefined ? "" : simulatedSpeakerName(scenario));

  const renderBody = () => {
    if (!view) {
      if (!speaker && scenario === undefined) {
        return (
          <EmptyState
            icon={icons.speaker}
            title="Speaker not found"
            actions={
              <Button label="Go back" variant="secondary" onPress={close} />
            }
          />
        );
      }
      return (
        <IntroView
          speakerName={speakerName}
          serverHost={host}
          alreadySetUp={radioSetup.data === true}
          onStart={() => {
            startConfigure(
              {
                deviceID: id,
                name: speaker?.name ?? "",
                host: speaker?.host ?? "",
                otherSpeakers: speakers.filter((other) => other !== speaker),
              },
              scenario,
            );
          }}
          onCancel={close}
        />
      );
    }
    switch (view.kind) {
      case "working": {
        return (
          <WorkingView
            view={view}
            speakerName={speakerName}
            serverHost={host}
          />
        );
      }
      case "failed": {
        return (
          <FailedView
            view={view}
            speakerName={speakerName}
            serverHost={host}
            onAction={(action) => {
              run?.session.act(action);
            }}
            onClose={() => {
              endConfigure(id);
              close();
            }}
            onShowLogs={() => {
              router.push("/logs");
            }}
          />
        );
      }
      default: {
        return (
          <DoneView
            view={view}
            speakerName={speakerName}
            serverHost={host}
            onDone={() => {
              endConfigure(id);
              close();
            }}
          />
        );
      }
    }
  };

  return (
    <Screen>
      <Stack.Title>Internet radio</Stack.Title>
      {view?.kind === "working" && <KeepAwake />}
      <ScrollView
        contentContainerStyle={$content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {run?.scenario !== undefined && (
          <Text variant="caption" color="warning" style={$simulated}>
            Simulated: {run.scenario}
          </Text>
        )}
        {renderBody()}
      </ScrollView>
    </Screen>
  );
}

const $content: ViewStyle = {
  paddingHorizontal: space.screen,
  paddingBottom: space.xxxl,
  gap: space.md,
};

const $simulated: TextStyle = {
  textAlign: "center",
};
