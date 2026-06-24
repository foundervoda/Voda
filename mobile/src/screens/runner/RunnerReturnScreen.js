import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../../api/client";
import { useSocket } from "../../api/SocketContext";

export default function RunnerReturnScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const socket = useSocket();
  const { order: initialOrder } = route.params;
  const [order, setOrder] = useState(initialOrder);

  const phase = order.status === "WITH_RUNNER" ? 2 : 1;

  // Refresh order on focus to pick up status changes
  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get(`/runner/orders/${order.id}`);
      if (data.data.order) setOrder(data.data.order);
    } catch {}
  }, [order.id]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Live socket update
  useEffect(() => {
    if (!socket) return;
    socket.emit("join_order_room", order.id);
    const handler = ({ order: updated }) => {
      if (updated?.id === order.id) setOrder(updated);
    };
    socket.on("order_update", handler);
    return () => socket.off("order_update", handler);
  }, [socket, order.id]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Return Job</Text>
        <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 80 }]}>
        {/* Step indicators */}
        <View style={styles.steps}>
          <View style={[styles.stepDot, styles.stepDotActive]}>
            <Text style={styles.stepNumActive}>{phase === 2 ? "✓" : "1"}</Text>
          </View>
          <View style={[styles.stepLine, phase === 2 && styles.stepLineActive]} />
          <View style={[styles.stepDot, phase === 2 && styles.stepDotActive]}>
            <Text style={[styles.stepNum, phase === 2 && styles.stepNumActive]}>2</Text>
          </View>
        </View>

        {/* Items */}
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

        {phase === 1 && (
          <View style={styles.otpPanel}>
            <Text style={styles.otpPanelTitle}>Step 1 — Show this to the rider</Text>
            <Text style={styles.otpPanelDesc}>
              Meet the rider at the return kiosk. Show them this code — they'll enter it on their phone to hand over the package.
            </Text>
            {order.deliveryOtp ? (
              <>
                <Text style={styles.otpLabel}>RIDER CONFIRMATION CODE</Text>
                <View style={styles.otpBox}>
                  <Text style={styles.otpCode}>{order.deliveryOtp}</Text>
                </View>
                <Text style={styles.otpHint}>Waiting for rider to confirm…</Text>
              </>
            ) : (
              <Text style={styles.otpHint}>Waiting for OTP to generate…</Text>
            )}
          </View>
        )}

        {phase === 2 && (
          <View style={[styles.otpPanel, styles.otpPanelReady]}>
            <Ionicons name="checkmark-circle" size={32} color="#16a34a" style={{ marginBottom: 8 }} />
            <Text style={styles.otpPanelTitle}>Step 2 — Rider confirmed!</Text>
            <Text style={styles.otpPanelDesc}>
              The rider has handed over the package. Now go to the kiosk and scan all items to log them back into store inventory.
            </Text>
            <View style={styles.kioskIdBox}>
              <Text style={styles.kioskIdLabel}>ENTER THIS AT THE KIOSK</Text>
              <Text style={styles.kioskIdCode}>#{order.id.slice(-6).toUpperCase()}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {phase === 2 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable style={styles.btn} onPress={() => navigation.popToTop()}>
            <Text style={styles.btnText}>Done — Back to Dashboard</Text>
          </Pressable>
        </View>
      )}
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
  back: { fontSize: 15, color: S, fontWeight: "600", width: 60 },
  title: { fontSize: 18, fontWeight: "700", color: S },
  orderId: { fontSize: 13, fontWeight: "900", color: S, fontVariant: ["tabular-nums"] },
  body: { padding: 16 },
  steps: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#e8e0cc", alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: S },
  stepNum: { fontSize: 13, fontWeight: "800", color: "#aaa" },
  stepNumActive: { fontSize: 13, fontWeight: "800", color: Y },
  stepLine: { flex: 1, height: 2, backgroundColor: "#e8e0cc", maxWidth: 60 },
  stepLineActive: { backgroundColor: S },
  section: { marginBottom: 22 },
  label: { fontSize: 10, fontWeight: "700", color: S, letterSpacing: 1, opacity: 0.5, marginBottom: 6 },
  itemRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  qty: { fontSize: 14, fontWeight: "700", color: S, width: 28, marginRight: 8 },
  itemName: { fontSize: 14, fontWeight: "600", color: S },
  itemVariant: { fontSize: 12, color: "#777", marginTop: 2 },
  otpPanel: {
    backgroundColor: "#fff", borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: "#e8e0cc", marginBottom: 12,
  },
  otpPanelReady: { borderColor: "#86efac", backgroundColor: "#f0fdf4" },
  otpPanelTitle: { fontSize: 15, fontWeight: "800", color: S, marginBottom: 6 },
  otpPanelDesc: { fontSize: 12, color: "#666", lineHeight: 18, marginBottom: 14 },
  otpLabel: { fontSize: 10, fontWeight: "700", color: S, letterSpacing: 1, opacity: 0.6, marginBottom: 8 },
  otpBox: {
    backgroundColor: S, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 24,
    alignItems: "center", marginBottom: 10,
  },
  otpCode: { fontSize: 36, fontWeight: "900", color: Y, letterSpacing: 10, fontVariant: ["tabular-nums"] },
  otpHint: { fontSize: 12, color: "#888", textAlign: "center" },
  kioskIdBox: {
    backgroundColor: S, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20,
    alignItems: "center", marginTop: 8,
  },
  kioskIdLabel: { fontSize: 9, fontWeight: "700", color: Y, letterSpacing: 1.5, marginBottom: 6 },
  kioskIdCode: { fontSize: 28, fontWeight: "900", color: Y, letterSpacing: 4, fontVariant: ["tabular-nums"] },
  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: "#fdf9ea", borderTopWidth: 1, borderColor: "#e8e0cc",
  },
  btn: { backgroundColor: Y, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnText: { fontSize: 15, fontWeight: "700", color: S },
});
