import { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";

export default function RiderArrivedScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { order, otp: testOtp } = route.params;
  const [otpInput, setOtpInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function verifyOtp() {
    if (otpInput.length !== 6) {
      setError("Please enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post(`/rider/orders/${order.id}/verify-otp`, { otp: otpInput });
      navigation.replace("RiderTnbTimer", { order: data.data.order });
    } catch (err) {
      const msg = err.response?.data?.error?.message ?? "Verification failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>You've Arrived</Text>
          <Text style={styles.subtitle}>Ask the customer for their OTP to confirm handover</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.addressCard}>
            <Text style={styles.addressLabel}>DELIVERING TO</Text>
            <Text style={styles.addressValue} numberOfLines={2}>{order.deliveryAddr}</Text>
            <Text style={styles.customerPhone}>{order.customer?.phone ?? ""}</Text>
          </View>

          {/* Test-mode chip — remove when customer app shows OTP */}
          {testOtp ? (
            <View style={styles.testChip}>
              <Text style={styles.testChipLabel}>TEST MODE — Customer OTP</Text>
              <Text style={styles.testChipOtp}>{testOtp}</Text>
            </View>
          ) : null}

          <Text style={styles.inputLabel}>Enter OTP from customer</Text>
          <TextInput
            style={[styles.otpInput, error && styles.otpInputError]}
            value={otpInput}
            onChangeText={(v) => {
              setOtpInput(v.replace(/\D/g, "").slice(0, 6));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor="#ccc"
            autoFocus
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={[styles.btn, (loading || otpInput.length !== 6) && styles.btnDisabled]}
            onPress={verifyOtp}
            disabled={loading || otpInput.length !== 6}
          >
            {loading
              ? <ActivityIndicator color={S} />
              : <Text style={styles.btnText}>Verify & Start T&B Timer</Text>}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const S = "#012a62";
const Y = "#fdde59";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdf9ea" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: "#e8e0cc",
  },
  title: { fontSize: 22, fontWeight: "700", color: S },
  subtitle: { fontSize: 13, color: "#888", marginTop: 3 },
  body: { flex: 1, padding: 16 },
  addressCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e8e0cc",
    marginBottom: 20,
  },
  addressLabel: { fontSize: 10, fontWeight: "700", color: S, letterSpacing: 1, opacity: 0.5, marginBottom: 6 },
  addressValue: { fontSize: 15, fontWeight: "600", color: S, marginBottom: 4 },
  customerPhone: { fontSize: 13, color: "#888" },
  testChip: {
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderStyle: "dashed",
  },
  testChipLabel: { fontSize: 10, fontWeight: "700", color: "#999", letterSpacing: 0.8, marginBottom: 4 },
  testChipOtp: { fontSize: 28, fontWeight: "700", color: "#555", letterSpacing: 6 },
  inputLabel: { fontSize: 12, fontWeight: "600", color: S, opacity: 0.6, marginBottom: 8 },
  otpInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e8e0cc",
    fontSize: 32,
    fontWeight: "700",
    color: S,
    textAlign: "center",
    letterSpacing: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  otpInputError: { borderColor: "#e53935" },
  errorText: { color: "#e53935", fontSize: 13, marginTop: 8, textAlign: "center" },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: "#e8e0cc",
    backgroundColor: "#fdf9ea",
  },
  btn: { backgroundColor: Y, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 16, fontWeight: "700", color: S },
});
