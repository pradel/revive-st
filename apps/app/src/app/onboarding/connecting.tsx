import { useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
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
            Could not connect to the speaker. Make sure you are near it and try again. If you are on
            iOS, your home and speaker networks may conflict — try on a different WiFi network.
          </Text>
          <Pressable style={styles.button} onPress={() => dispatch({ type: "RETRY" })}>
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
