import { useState } from "react";
import { View, Text, TextInput, Pressable, Image, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useAuthStore } from "../store/useAuthStore";

const ROLE = "CUSTOMER";

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({ email: "", password: "", phone: "" });
  const [error, setError] = useState(null);
  const register = useAuthStore((s) => s.register);

  const update = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const handleRegister = async () => {
    setError(null);
    try {
      await register({ ...form, role: ROLE });
    } catch (err) {
      setError(err?.response?.data?.error?.message ?? "Could not register");
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
          value={form.email}
          onChangeText={update("email")}
        />
        <TextInput
          style={s.input}
          placeholder="Phone"
          placeholderTextColor="#012a6280"
          keyboardType="phone-pad"
          value={form.phone}
          onChangeText={update("phone")}
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor="#012a6280"
          secureTextEntry
          value={form.password}
          onChangeText={update("password")}
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Pressable style={s.btn} onPress={handleRegister}>
          <Text style={s.btnText}>Create account</Text>
        </Pressable>

        <Pressable style={s.link} onPress={() => navigation.navigate("Login")}>
          <Text style={s.linkText}>Already have an account? Log in</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#fdf9ea", justifyContent: "center", paddingHorizontal: 24 },
  logoWrap:{ alignItems: "center", marginBottom: 24 },
  logo:    { width: 160, height: 160 },
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
