import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";

export default function RunnerReturnScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { order: initialOrder } = route.params;
  const [order, setOrder] = useState(initialOrder);
  const [step, setStep] = useState(1); // 1: enter rider OTP, 2: enter store OTP
  const [riderOtp, setRiderOtp] = useState("");
  const [storeOtp, setStoreOtp] = useState("");
  const [loading, setLoading] = useState(false);

  async function acceptReturn() {
    if (riderOtp.trim().length !== 6) {
      Alert.alert("Error", "Enter the 6-digit code from the rider");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post(`/runner/orders/${order.id}/accept-return`, { otp: riderOtp.trim() });
      setOrder(data.data.order);
      setStoreOtp("");
      setStep(2);
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error?.message ?? "Failed to accept return");
    } finally {
      setLoading(false);
    }
  }

  async function completeReturn() {
    if (storeOtp.trim().length !== 6) {
      Alert.alert("Error", "Enter the 6-digit code from the store");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/runner/orders/${order.id}/complete-return`, { otp: storeOtp.trim() });
      navigation.popToTop();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error?.message ?? "Failed to complete return");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Return Job</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 110 }]}>
        <View style={styles.badge}>
          <Text style={styles.badgeIcon}>↩</Text>
          <Text style={styles.badgeText}>Return to Store</Text>
        </View>

        {/* Step indicators */}
        <View style={styles.steps}>
          <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
            <Text style={[styles.stepNum, step >= 1 && styles.stepNumActive]}>1</Text>
          </View>
          <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
            <Text style={[styles.stepNum, step >= 2 && styles.stepNumActive]}>2</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>COLLECT FROM (DELIVERY ADDRESS)</Text>
          <Text style={styles.value}>{order.deliveryAddr}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>ITEMS TO RETURN</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.qty}>{item.quantity}×</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.product.name}</Text>
                <Text style={styles.itemVariant}>
                  {item.variant.size}{item.variant.color ? ` · ${item.variant.color}` : ""}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {step === 1 && (
          <View style={styles.otpPanel}>
            <Text style={styles.otpPanelTitle}>Step 1: Collect from Rider</Text>
            <Text style={styles.otpPanelDesc}>
              Get the package from the rider. Enter the code displayed on the rider's screen.
            </Text>
            <Text style={styles.otpLabel}>RIDER HANDOFF CODE</Text>
            <TextInput
              style={styles.otpInput}
              placeholder="6-digit code"
              placeholderTextColor="#012a6240"
              keyboardType="number-pad"
              maxLength={6}
              value={riderOtp}
              onChangeText={setRiderOtp}
              autoFocus
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.otpPanel}>
            <Text style={styles.otpPanelTitle}>Step 2: Return to Store</Text>
            <Text style={styles.otpPanelDesc}>
              Bring the package to the store. The store will see a code on their screen — ask them for it and enter it below.
            </Text>
            <Text style={styles.otpLabel}>STORE CONFIRMATION CODE</Text>
            <TextInput
              style={styles.otpInput}
              placeholder="6-digit code"
              placeholderTextColor="#012a6240"
              keyboardType="number-pad"
              maxLength={6}
              value={storeOtp}
              onChangeText={setStoreOtp}
              autoFocus
            />
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step === 1 ? (
          <Pressable
            style={[styles.btn, (riderOtp.trim().length !== 6 || loading) && styles.btnDisabled]}
            onPress={acceptReturn}
            disabled={riderOtp.trim().length !== 6 || loading}
          >
            {loading ? <ActivityIndicator color={S} /> : <Text style={styles.btnText}>Collect from Rider ✓</Text>}
          </Pressable>
        ) : (
          <Pressable
            style={[styles.btn, (storeOtp.trim().length !== 6 || loading) && styles.btnDisabled]}
            onPress={completeReturn}
            disabled={storeOtp.trim().length !== 6 || loading}
          >
            {loading ? <ActivityIndicator color={S} /> : <Text style={styles.btnText}>Items Returned to Store ✓</Text>}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const S = "#012a62";
const Y = "#fdde59";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdf9ea" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#e8e0cc",
  },
  back: { fontSize: 15, color: S, fontWeight: "600" },
  title: { fontSize: 18, fontWeight: "700", color: S },
  body: { padding: 16 },
  badge: {
    backgroundColor: "#fff3e0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  badgeIcon: { fontSize: 24 },
  badgeText: { fontSize: 16, fontWeight: "700", color: "#e65100" },
  steps: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    gap: 0,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e8e0cc",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: { backgroundColor: S },
  stepNum: { fontSize: 13, fontWeight: "800", color: "#aaa" },
  stepNumActive: { color: Y },
  stepLine: { flex: 1, height: 2, backgroundColor: "#e8e0cc", maxWidth: 60 },
  stepLineActive: { backgroundColor: S },
  section: { marginBottom: 22 },
  label: { fontSize: 10, fontWeight: "700", color: S, letterSpacing: 1, opacity: 0.5, marginBottom: 6 },
  value: { fontSize: 15, fontWeight: "500", color: S },
  itemRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  qty: { fontSize: 14, fontWeight: "700", color: S, width: 28, marginRight: 8 },
  itemName: { fontSize: 14, fontWeight: "600", color: S },
  itemVariant: { fontSize: 12, color: "#777", marginTop: 2 },
  otpPanel: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e8e0cc",
    marginBottom: 12,
  },
  otpPanelTitle: { fontSize: 15, fontWeight: "800", color: S, marginBottom: 6 },
  otpPanelDesc: { fontSize: 12, color: "#666", lineHeight: 18, marginBottom: 14 },
  otpLabel: { fontSize: 10, fontWeight: "700", color: S, letterSpacing: 1, opacity: 0.6, marginBottom: 6 },
  otpInput: {
    borderWidth: 1.5,
    borderColor: S,
    borderRadius: 10,
    paddingVertical: 10,
    fontSize: 22,
    color: S,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 8,
    backgroundColor: "#fdf9ea",
  },
  footer: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    padding: 16,
    backgroundColor: "#fdf9ea",
    borderTopWidth: 1,
    borderColor: "#e8e0cc",
  },
  btn: { backgroundColor: Y, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 15, fontWeight: "700", color: S },
});
