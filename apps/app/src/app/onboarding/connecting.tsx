import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";
import { openWifiSettings, connectToOpenNetwork } from "expo-bose-wifi";
import { findSpeakerIP } from "@/features/onboarding/utils/networkHelpers";

export default function ConnectingScreen() {
  const { state, dispatch } = useWifiProvisioning();
  const router = useRouter();
  const [manualPolling, setManualPolling] = useState(false);

  useEffect(() => {
    if (state.step === "CONNECTED_TO_HOTSPOT") {
      router.replace("/onboarding/network-picker" as any);
    }
  }, [state.step, router]);

  const isFailed = state.step === "CONNECTION_FAILED";

  const handleManualRetry = useCallback(async () => {
    setManualPolling(true);
    const s = state as { ssid: string; bssid: string };
    try {
      // Call specifier to bind process to the Bose network
      console.log(
        "[Manual Retry] Calling connectToOpenNetwork with",
        s.ssid,
        s.bssid,
      );
      await connectToOpenNetwork(s.ssid, s.bssid);
      console.log("[Manual Retry] Specifier succeeded, probing speaker IP...");
    } catch {
      console.log(
        "[Manual Retry] Specifier also failed, trying IP probe anyway...",
      );
    }
    for (let i = 0; i < 30; i++) {
      const ip = await findSpeakerIP();
      if (ip) {
        dispatch({
          type: "HOTSPOT_CONNECTED",
          ssid: s.ssid,
          speakerIP: ip,
        });
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log("[Manual Retry] Speaker not reachable after 30s polling");
    setManualPolling(false);
  }, [state, dispatch]);

  const handleOpenWifiSettings = useCallback(() => {
    void openWifiSettings();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connecting</Text>
      {!isFailed && !manualPolling && (
        <>
          <ActivityIndicator size="large" style={styles.spinner} />
          <Text style={styles.statusText}>Connecting to your speaker...</Text>
        </>
      )}
      {manualPolling && (
        <>
          <ActivityIndicator size="large" style={styles.spinner} />
          <Text style={styles.statusText}>
            Looking for speaker on the network...
          </Text>
        </>
      )}
      {isFailed && !manualPolling && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            Could not connect to the speaker automatically.
          </Text>
          {Platform.OS === "android" && (
            <View style={styles.staticIpBox}>
              <Text style={styles.staticIpTitle}>Manual setup (fallback):</Text>
              <Text style={styles.staticIpStep}>
                Open WiFi Settings and connect to the Bose network. Then
                configure static IP:
              </Text>
              <View style={styles.ipRow}>
                <Text style={styles.ipLabel}>IP:</Text>
                <Text style={styles.ipValue}>192.0.2.50</Text>
              </View>
              <View style={styles.ipRow}>
                <Text style={styles.ipLabel}>Gateway:</Text>
                <Text style={styles.ipValue}>192.0.2.1</Text>
              </View>
              <View style={styles.ipRow}>
                <Text style={styles.ipLabel}>Prefix:</Text>
                <Text style={styles.ipValue}>24</Text>
              </View>
              <View style={styles.ipRow}>
                <Text style={styles.ipLabel}>DNS 1:</Text>
                <Text style={styles.ipValue}>192.0.2.1</Text>
              </View>
              <Pressable
                style={styles.settingsButton}
                onPress={handleOpenWifiSettings}
              >
                <Text style={styles.settingsButtonText}>
                  Open WiFi Settings
                </Text>
              </Pressable>
              <Text style={styles.staticIpStep}>
                After connecting, tap the button below:
              </Text>
              <Pressable style={styles.button} onPress={handleManualRetry}>
                <Text style={styles.buttonText}>
                  I&apos;m Connected — Continue
                </Text>
              </Pressable>
            </View>
          )}
          {Platform.OS !== "android" && (
            <Pressable
              style={styles.button}
              onPress={() => dispatch({ type: "RETRY" })}
            >
              <Text style={styles.buttonText}>Try Again</Text>
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
  staticIpBox: {
    backgroundColor: "#f0f6ff",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    gap: 6,
    alignItems: "center",
  },
  staticIpTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  staticIpStep: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 4,
  },
  ipRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  ipLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    width: 70,
    textAlign: "right",
  },
  ipValue: {
    fontSize: 14,
    color: "#208AEF",
    fontWeight: "500",
    width: 110,
  },
  settingsButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#208AEF",
    borderRadius: 8,
    marginVertical: 8,
  },
  settingsButtonText: {
    color: "#208AEF",
    fontSize: 14,
    fontWeight: "600",
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
});
