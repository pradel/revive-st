import { useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";

export default function PermissionsScreen() {
  const { state, dispatch } = useWifiProvisioning();
  const router = useRouter();

  useEffect(() => {
    if (state.step === "SCANNING_FOR_HOTSPOT") {
      router.replace("/onboarding/scanning" as any);
    }
  }, [state.step, router]);

  const isDenied = state.step === "PERMISSIONS_DENIED";
  const isLoading = state.step === "CHECKING_PERMISSIONS";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Location Access</Text>
      <Text style={styles.description}>
        To find your Bose SoundTouch speaker, this app needs access to your location. This is used
        to scan for nearby WiFi networks and identify your speaker.
      </Text>
      {isLoading && <ActivityIndicator size="large" style={styles.spinner} />}
      {isDenied && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            Location access was denied. Enable it in Settings to continue.
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
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    color: "#555",
    marginBottom: 24,
  },
  spinner: {
    marginTop: 16,
  },
  errorBox: {
    alignItems: "center",
    gap: 16,
  },
  errorText: {
    fontSize: 14,
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
