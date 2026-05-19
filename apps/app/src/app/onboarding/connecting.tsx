import { useEffect } from "react";
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

export default function ConnectingScreen() {
  const { state, dispatch } = useWifiProvisioning();
  const router = useRouter();

  useEffect(() => {
    if (state.step === "CONNECTED_TO_HOTSPOT") {
      router.replace("/onboarding/network-picker" as any);
    }
  }, [state.step, router]);

  const isFailed = state.step === "CONNECTION_FAILED";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connecting</Text>
      {!isFailed && (
        <>
          <ActivityIndicator size="large" style={styles.spinner} />
          <Text style={styles.statusText}>Connecting to your speaker...</Text>
        </>
      )}
      {isFailed && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            Could not connect to the speaker. Make sure you are near it and try
            again.
          </Text>
          {Platform.OS === "android" && (
            <View style={styles.staticIpBox}>
              <Text style={styles.staticIpTitle}>
                If connection keeps failing, set a static IP in your phone
                {"\n"}WiFi settings before connecting:
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
            </View>
          )}
          <Pressable
            style={styles.button}
            onPress={() => dispatch({ type: "RETRY" })}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
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
    gap: 16,
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
  },
  staticIpTitle: {
    fontSize: 14,
    color: "#444",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 20,
  },
  ipRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  ipLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    width: 70,
    textAlign: "right",
  },
  ipValue: {
    fontSize: 15,
    color: "#208AEF",
    fontWeight: "500",
    width: 100,
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
