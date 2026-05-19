import { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";
import { useSpeakerDiscovery } from "@/features/onboarding/hooks/useSpeakerDiscovery";
import { MDNS_DISCOVERY_TIMEOUT_MS } from "@/features/onboarding/utils/networkHelpers";

export default function ProgressScreen() {
  const { state, dispatch } = useWifiProvisioning();
  const router = useRouter();

  useEffect(() => {
    if (state.step === "PROVISIONING_COMPLETE") {
      router.replace("/onboarding/success" as any);
    }
  }, [state.step, router]);

  const { start: startDiscovery } = useSpeakerDiscovery({
    timeoutMs: MDNS_DISCOVERY_TIMEOUT_MS,
    onDiscovered: (result) => {
      dispatch({
        type: "SPEAKER_DISCOVERED",
        host: result.host,
        port: result.port,
        name: result.name,
      });
    },
    onTimeout: () => {
      dispatch({ type: "DISCOVERY_TIMEOUT" });
    },
    onError: () => {
      dispatch({ type: "DISCOVERY_TIMEOUT" });
    },
  });

  useEffect(() => {
    if (state.step === "DISCOVERING_SPEAKER") {
      startDiscovery();
    }
  }, [state.step, startDiscovery]);

  const step = state.step;

  const statusText = (() => {
    switch (step) {
      case "SENDING_CREDENTIALS":
        return "Sending credentials to your speaker...";
      case "WAITING_FOR_SPEAKER_ON_NETWORK":
        return "Waiting for your speaker to join the network...";
      case "DISCOVERING_SPEAKER":
        return "Discovering your speaker on the network...";
      default:
        return "Setting up...";
    }
  })();

  const isError = step === "CREDENTIALS_FAILED" || step === "DISCOVERY_TIMEOUT";

  const errorMessage = (() => {
    if (step === "CREDENTIALS_FAILED") {
      return "The speaker did not accept the network details. Check your password and try again.";
    }
    if (step === "DISCOVERY_TIMEOUT") {
      return "Your speaker connected to WiFi but we could not find it. Try again, or enter the IP manually.";
    }
    return "";
  })();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Setting Up</Text>

      {!isError && (
        <>
          <ActivityIndicator size="large" style={styles.spinner} />
          <Text style={styles.statusText}>{statusText}</Text>
        </>
      )}

      {isError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable
            style={styles.button}
            onPress={() => dispatch({ type: "RETRY" })}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
          {step === "DISCOVERY_TIMEOUT" && (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => dispatch({ type: "ENTER_MANUAL_IP" })}
            >
              <Text style={styles.secondaryButtonText}>Enter IP Manually</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 24,
  },
  spinner: {
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
  },
  errorBox: {
    alignItems: "center",
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    color: "#d32f2f",
    textAlign: "center",
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#208AEF",
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#208AEF",
    fontSize: 14,
  },
});
