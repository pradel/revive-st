import { useRouter } from "expo-router";
import { Text, View, StyleSheet, Pressable } from "react-native";

export default function Index() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.button}
        onPress={() => router.push("/onboarding/permissions" as any)}
      >
        <Text style={styles.buttonText}>Set Up Speaker</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: "#208AEF",
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
