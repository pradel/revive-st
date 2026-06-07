import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";

import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";

export default function ScanningScreen() {
  const { state, dispatch } = useWifiProvisioning();
  const router = useRouter();

  useEffect(() => {
    if (state.step === "CONNECTING_TO_HOTSPOT") {
      router.replace("/onboarding/connecting" as any);
    } else if (state.step === "MANUAL_IP_ENTRY") {
      router.push("/onboarding/manual-ip" as any);
    } else if (state.step === "WIFI_DISABLED") {
      router.replace("/onboarding/wifi-enable" as any);
    }
  }, [state.step, router]);

  const isNotFound = state.step === "HOTSPOT_NOT_FOUND";
  const isScanning = state.step === "SCANNING_FOR_HOTSPOT";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Find Your Speaker</Text>
      {isScanning && (
        <>
          <ActivityIndicator size="large" style={styles.spinner} />
          <Text style={styles.statusText}>Scanning for your speaker...</Text>
        </>
      )}
      {isNotFound && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            No Bose speaker found nearby. Make sure your speaker is in setup
            mode.
          </Text>
          <Text style={styles.hintText}>
            Hold the power button for 5 seconds until the light pulses white.
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => {
              dispatch({ type: "RETRY" });
            }}
          >
            <Text style={styles.buttonText}>Scan Again</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              dispatch({ type: "ENTER_MANUAL_IP" });
            }}
          >
            <Text style={styles.secondaryButtonText}>Enter IP Manually</Text>
          </Pressable>
        </View>
      )}
      {isScanning && (
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            dispatch({ type: "ENTER_MANUAL_IP" });
          }}
        >
          <Text style={styles.secondaryButtonText}>Enter IP Manually</Text>
        </Pressable>
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
    marginBottom: 24,
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
  hintText: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginBottom: 8,
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
