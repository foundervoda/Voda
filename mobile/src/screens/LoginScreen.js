import { useState } from "react";
import { View, Text, TextInput, Pressable, Image, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useAuthStore } from "../store/useAuthStore";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const login = useAuthStore((s) => s.login);

  const handleLogin = async () => {
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? "Could not log in");
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.root}>
      <View style={s.logoWrap}>
        <Image source={require("../../assets/Voda Logo.png")} style={s.logo} resizeMode="contain" />
      </View>

      <View style={s.card}>
        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor="#012a6280"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor="#012a6280"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Pressable style={s.btn} onPress={handleLogin}>
          <Text style={s.btnText}>Log in</Text>
        </Pressable>

        <Pressable style={s.link} onPress={() => navigation.navigate("Register")}>
          <Text style={s.linkText}>Need an account? Register</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#fdf9ea", justifyContent: "center", paddingHorizontal: 24 },
  logoWrap:{ alignItems: "center", marginBottom: 32 },
  logo:    { width: 200, height: 200 },
  card:    { width: "100%" },
  input:   {
    borderWidth: 1, borderColor: "#012a6240", borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 12, fontSize: 15, color: "#012a62",
    backgroundColor: "#fffef5",
  },
  error:   { color: "#dc2626", marginBottom: 10, fontSize: 13 },
  btn:     { backgroundColor: "#012a62", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fdde59", fontWeight: "700", fontSize: 16 },
  link:    { marginTop: 18, alignItems: "center" },
  linkText:{ color: "#012a6299", fontSize: 14 },
});
