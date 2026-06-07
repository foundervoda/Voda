import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
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
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-2xl font-bold mb-6">Create your account</Text>

      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-3"
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={form.email}
        onChangeText={update("email")}
      />
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-3"
        placeholder="Phone"
        keyboardType="phone-pad"
        value={form.phone}
        onChangeText={update("phone")}
      />
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-3"
        placeholder="Password"
        secureTextEntry
        value={form.password}
        onChangeText={update("password")}
      />

      {error ? <Text className="text-red-500 mb-3">{error}</Text> : null}

      <Pressable className="bg-emerald-500 rounded-lg py-3 items-center" onPress={handleRegister}>
        <Text className="text-white font-semibold">Create account</Text>
      </Pressable>

      <Pressable className="mt-4 items-center" onPress={() => navigation.navigate("Login")}>
        <Text className="text-emerald-600">Already have an account? Log in</Text>
      </Pressable>
    </View>
  );
}
