import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
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
      setError(err?.response?.data?.error?.message ?? "Could not log in");
    }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-2xl font-bold mb-6">Log in</Text>

      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-3"
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-3"
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text className="text-red-500 mb-3">{error}</Text> : null}

      <Pressable className="bg-emerald-500 rounded-lg py-3 items-center" onPress={handleLogin}>
        <Text className="text-white font-semibold">Log in</Text>
      </Pressable>

      <Pressable className="mt-4 items-center" onPress={() => navigation.navigate("Register")}>
        <Text className="text-emerald-600">Need an account? Register</Text>
      </Pressable>
    </View>
  );
}
