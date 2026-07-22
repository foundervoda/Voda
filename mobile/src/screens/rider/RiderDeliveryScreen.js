import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useSocket } from "../../api/SocketContext";

export default function RiderDeliveryScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const socket = useSocket();
  const [order, setOrder] = useState(route.params.order);
  const [loading, setLoading] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [runnerOtpInput, setRunnerOtpInput] = useState("");
  const [pendingOtpMode, setPendingOtpMode] = useState(null); // "keep" | "return" | null
  const [pendingOtpInput, setPendingOtpInput] = useState("");
  const [handoffLoading, setHandoffLoading] = useState(false);

  const isTryBuy = order.deliveryAddr?.includes(" | Try & Buy") || order.isTryAndBuy;

  function calcDisplaySecs(end) {
    if (!end) return 0;
    return Math.max(0, Math.floor((new Date(end).getTime() - Date.now()) / 1000));
  }

  const [timeLeftSecs, setTimeLeftSecs] = useState(() => calcDisplaySecs(order.tryTimerEnd));
  const showTimer = order.status === "TRY_BUY_IN_PROGRESS" && timeLeftSecs > 0;
  const showTimerExpiredChoice = order.status === "TRY_BUY_IN_PROGRESS" && !showTimer;

  // Socket listener for real-time status updates (e.g. customer finalizes keeps)
  useEffect(() => {
    if (!socket) return;

    socket.emit("join_order_room", order.id);

    const handleUpdate = ({ order: updatedOrder }) => {
      if (!updatedOrder || updatedOrder.id !== order.id) return;
      setOrder(updatedOrder);
      if (updatedOrder.status === "DELIVERED") {
        navigation.popToTop();
      } else if (
        updatedOrder.status === "TRY_BUY_IN_PROGRESS" &&
        new Date(updatedOrder.tryTimerEnd).getTime() <= 1000
      ) {
        const hasReturns = updatedOrder.items.some((i) => i.isReturned);
        setPendingOtpMode(hasReturns ? "return" : "keep");
      }
    };

    socket.on("order_update", handleUpdate);

    return () => {
      socket.off("order_update", handleUpdate);
    };
  }, [socket, order.id]);

  // Countdown from server tryTimerEnd — synced with customer TryBuyScreen
  useEffect(() => {
    if (order.status !== "TRY_BUY_IN_PROGRESS" || !order.tryTimerEnd) return;
    const interval = setInterval(() => {
      setTimeLeftSecs(calcDisplaySecs(order.tryTimerEnd));
    }, 500);
    return () => clearInterval(interval);
  }, [order.status, order.tryTimerEnd]);

  // Live GPS simulation relay during delivery transit
  useEffect(() => {
    if (order.status !== "OUT_FOR_DELIVERY" || !socket) return;

    const storeLat = 12.9716;
    const storeLng = 77.5946;
    const custLat = 12.9810;
    const custLng = 77.6030;

    let steps = 0;
    const totalSteps = 20;

    // Immediately send the first coordinate
    socket.emit("rider_location", {
      orderId: order.id,
      lat: storeLat,
      lng: storeLng,
    });

    const interval = setInterval(() => {
      steps++;
      const ratio = Math.min(steps / totalSteps, 1);
      const currentLat = storeLat + (custLat - storeLat) * ratio;
      const currentLng = storeLng + (custLng - storeLng) * ratio;

      socket.emit("rider_location", {
        orderId: order.id,
        lat: currentLat,
        lng: currentLng,
      });

      if (steps >= totalSteps) {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [order.status, order.id, socket]);

  const markArrived = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/rider/orders/${order.id}/arrive`);
      setOrder(data.data.order);
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error?.message ?? "Could not mark arrived");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otpInput.trim()) {
      Alert.alert("Error", "Please enter the 6-digit handover OTP from the customer");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post(`/rider/orders/${order.id}/verify-otp`, {
        otp: otpInput.trim(),
      });
      setOrder(data.data.order);
      setOtpInput("");
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error?.message ?? "Invalid OTP code");
    } finally {
      setLoading(false);
    }
  };

  const confirmRunnerHandoff = async () => {
    if (!runnerOtpInput.trim()) {
      Alert.alert("Error", "Enter the 6-digit code shown on the runner's phone");
      return;
    }
    setHandoffLoading(true);
    try {
      await api.post(`/rider/orders/${order.id}/confirm-runner-handoff`, { otp: runnerOtpInput.trim() });
      navigation.popToTop();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error?.message ?? "Incorrect code — ask the runner to show you their screen");
    } finally {
      setHandoffLoading(false);
    }
  };

  const closeDelivery = () => {
    navigation.popToTop();
  };

  const submitOtp = async () => {
    const trimmed = pendingOtpInput.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      if (pendingOtpMode === "keep") {
        await api.post(`/rider/orders/${order.id}/confirm-keep-otp`, { otp: trimmed });
        navigation.popToTop();
      } else {
        const { data } = await api.post(`/rider/orders/${order.id}/initiate-return`, { otp: trimmed });
        setOrder(data.data.order);
        setPendingOtpMode(null);
      }
    } catch (err) {
      Alert.alert("Incorrect OTP", err.response?.data?.error?.message ?? "OTP did not match — ask the customer to check their screen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Active Delivery</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 120 }]}>
        {/* Status Display */}
        <View style={styles.section}>
          <Text style={styles.label}>ORDER STATUS</Text>
          <Text style={styles.statusValue}>{order.status.replace(/_/g, " ")}</Text>
        </View>

        {/* Sync Countdown Clock — no rider actions, customer decides */}
        {showTimer && !pendingOtpMode && (
          <View style={styles.timerCard}>
            <Ionicons name="time" size={32} color="#012a62" />
            <Text style={styles.timerLabel}>Try & Buy Timer Active</Text>
            <Text style={styles.timerClock}>
              {String(Math.floor(timeLeftSecs / 60)).padStart(2, "0")}:{String(timeLeftSecs % 60).padStart(2, "0")}
            </Text>
            <Text style={styles.timerHint}>
              Customer is trying items at their doorstep. Timer is synchronized.
            </Text>
          </View>
        )}

        {/* Return in progress — rider enters runner's OTP at kiosk to hand off package */}
        {order.status === "RETURNING" && (
          <View style={styles.returningCard}>
            <Text style={styles.returningIcon}>↩</Text>
            <Text style={styles.returningTitle}>Return In Progress</Text>
            <Text style={styles.returningSubtitle}>
              Meet the runner at the return kiosk. Ask the runner to show you their 6-digit code, then enter it below to hand over the package.
            </Text>
            <Text style={styles.returningOtpLabel}>ENTER RUNNER'S CODE</Text>
            <TextInput
              style={styles.arrivedOtpInput}
              placeholder="6-digit code"
              placeholderTextColor="#012a6240"
              keyboardType="number-pad"
              maxLength={6}
              value={runnerOtpInput}
              onChangeText={setRunnerOtpInput}
              autoFocus
            />
            <Pressable style={[styles.btn, { marginTop: 12, width: "100%" }]} onPress={confirmRunnerHandoff} disabled={handoffLoading}>
              {handoffLoading ? <ActivityIndicator color={S} /> : <Text style={styles.btnText}>Confirm Handoff — Done</Text>}
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>DELIVERY ADDRESS</Text>
          <Text style={styles.value}>{order.deliveryAddr}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>CUSTOMER CONTACT</Text>
          <Text style={styles.value}>{order.customer?.phone}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>ITEMS TO DELIVER</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.qty}>{item.quantity}×</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.product.name}</Text>
                <Text style={styles.itemVariant}>
                  Size: {item.variant.size}
                  {item.variant.color ? ` · ${item.variant.color}` : ""}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Action Panel */}
        {order.status === "OUT_FOR_DELIVERY" && (
          <View style={styles.actionPanel}>
            <Pressable style={styles.btn} onPress={markArrived} disabled={loading}>
              {loading ? <ActivityIndicator color="#012a62" /> : <Text style={styles.btnText}>Mark Arrived</Text>}
            </Pressable>
          </View>
        )}

        {order.status === "ARRIVED" && (
          <View style={styles.actionPanel}>
            <View style={{ width: "100%", marginBottom: 16 }}>
              <Text style={styles.otpLabel}>ENTER CUSTOMER HANDOVER OTP</Text>
              <TextInput
                style={styles.arrivedOtpInput}
                placeholder="e.g. 123456"
                placeholderTextColor="#012a6240"
                keyboardType="number-pad"
                maxLength={6}
                value={otpInput}
                onChangeText={setOtpInput}
              />
              <Text style={styles.otpHint}>
                Ask the customer for the 6-digit OTP code displayed on their app.
              </Text>
            </View>
            <Pressable style={styles.btn} onPress={verifyOtp} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#012a62" />
              ) : (
                <Text style={styles.btnText}>{isTryBuy ? "Verify OTP & Start Trial" : "Verify OTP & Complete"}</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Timer expired — wait for customer to decide on their app */}
        {showTimerExpiredChoice && !pendingOtpMode && (
          <View style={styles.expiredCard}>
            <Text style={styles.expiredIcon}>⏰</Text>
            <Text style={styles.expiredTitle}>Try & Buy Time's Up</Text>
            <Text style={styles.expiredSubtitle}>
              Waiting for the customer to confirm on their app…
            </Text>
          </View>
        )}

        {/* OTP entry — appears when customer makes a decision (socket-triggered) */}
        {pendingOtpMode && (
          <View style={styles.otpPanel}>
            <View style={[styles.otpBadge, pendingOtpMode === "return" && styles.otpBadgeReturn]}>
              <Text style={styles.otpBadgeText}>
                {pendingOtpMode === "keep" ? "KEEP" : "RETURN"}
              </Text>
            </View>
            <Text style={styles.otpPanelTitle}>
              {pendingOtpMode === "keep"
                ? "Customer is keeping the items"
                : "Customer is returning the items"}
            </Text>
            <Text style={styles.otpPanelHint}>
              Ask the customer to show you their OTP, then enter it below.
            </Text>
            <TextInput
              style={styles.otpInput}
              placeholder="6-digit OTP"
              placeholderTextColor="#ffffff60"
              keyboardType="number-pad"
              maxLength={6}
              value={pendingOtpInput}
              onChangeText={setPendingOtpInput}
              autoFocus
            />
            <Pressable
              style={[styles.btn, (!pendingOtpInput.trim() || loading) && { opacity: 0.4 }]}
              onPress={submitOtp}
              disabled={!pendingOtpInput.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color={S} />
              ) : (
                <Text style={styles.btnText}>
                  {pendingOtpMode === "keep" ? "Confirm Keep & Complete" : "Confirm Return Pickup"}
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {order.status === "DELIVERED" && !showTimer && !showTimerExpiredChoice && (
          <View style={styles.completedCard}>
            <Ionicons name="checkmark-circle" size={44} color="#2e7d32" />
            <Text style={styles.completedTitle}>Handover Completed</Text>
            <Text style={styles.completedSubtitle}>
              Standard delivery complete.
            </Text>
            <Pressable style={[styles.btn, { marginTop: 14 }]} onPress={closeDelivery}>
              <Text style={styles.btnText}>Back to Dashboard</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
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
  back: { fontSize: 14, color: S, width: 60 },
  title: { fontSize: 17, fontWeight: "700", color: S },
  body: { padding: 16 },
  section: { marginBottom: 22 },
  label: { fontSize: 10, fontWeight: "700", color: S, letterSpacing: 1, opacity: 0.5, marginBottom: 6 },
  statusValue: { fontSize: 18, fontWeight: "800", color: S, textTransform: "uppercase" },
  value: { fontSize: 15, fontWeight: "500", color: S },
  itemRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  qty: { fontSize: 15, fontWeight: "700", color: S, width: 30, marginRight: 8 },
  itemName: { fontSize: 15, fontWeight: "600", color: S },
  itemVariant: { fontSize: 13, color: "#777", marginTop: 2 },
  actionPanel: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e8e0cc",
    alignItems: "center",
  },
  btn: { backgroundColor: Y, borderRadius: 10, paddingVertical: 14, alignItems: "center", width: "100%" },
  btnText: { fontSize: 16, fontWeight: "700", color: S },
  otpLabel: { fontSize: 11, fontWeight: "800", color: S, opacity: 0.7, marginBottom: 8 },
  otpInput: {
    width: "100%",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 28,
    color: S,
    textAlign: "center",
    fontWeight: "800",
    letterSpacing: 8,
    backgroundColor: "#fff",
    marginBottom: 4,
  },
  // used for ARRIVED handover OTP (dark border, cream bg)
  arrivedOtpInput: {
    borderWidth: 1.5,
    borderColor: S,
    borderRadius: 10,
    padding: 12,
    fontSize: 22,
    color: S,
    textAlign: "center",
    fontWeight: "800",
    letterSpacing: 8,
    backgroundColor: "#fdf9ea",
    marginBottom: 8,
  },
  otpHint: { fontSize: 11, color: "#888", textAlign: "center" },
  stdHint: { fontSize: 13, color: "#555", marginBottom: 14, textAlign: "center" },
  timerCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Y,
    marginBottom: 22,
  },
  timerLabel: { fontSize: 12, fontWeight: "800", color: S, opacity: 0.6, marginTop: 6 },
  timerClock: { fontSize: 36, fontWeight: "900", color: S, marginVertical: 6, fontVariant: ["tabular-nums"] },
  timerHint: { fontSize: 11, color: "#888", textAlign: "center" },
  completedCard: {
    backgroundColor: "#e8f5e9",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#a5d6a7",
  },
  completedTitle: { fontSize: 18, fontWeight: "800", color: "#2e7d32", marginTop: 10 },
  completedSubtitle: { fontSize: 12, color: "#2e7d32b0", textAlign: "center", marginTop: 4, lineHeight: 17 },
  otpPanel: {
    backgroundColor: S,
    borderRadius: 16,
    padding: 20,
    marginBottom: 22,
    alignItems: "center",
    gap: 12,
  },
  otpBadge: {
    backgroundColor: Y,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  otpBadgeReturn: { backgroundColor: "#ff7043" },
  otpBadgeText: { fontSize: 12, fontWeight: "800", color: S, letterSpacing: 1 },
  otpPanelTitle: { fontSize: 16, fontWeight: "700", color: "#fff", textAlign: "center" },
  otpPanelHint: { fontSize: 12, color: "#ffffff99", textAlign: "center", lineHeight: 17 },
  returningCard: {
    backgroundColor: "#fff3e0",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffcc80",
    marginBottom: 22,
  },
  returningIcon: { fontSize: 32, color: "#e65100" },
  returningTitle: { fontSize: 17, fontWeight: "800", color: "#e65100", marginTop: 6 },
  returningSubtitle: { fontSize: 12, color: "#bf360c", textAlign: "center", marginTop: 4, lineHeight: 17 },
  returningOtpBox: {
    marginTop: 14,
    backgroundColor: "#e65100",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    width: "100%",
  },
  returningOtpLabel: { fontSize: 9, fontWeight: "800", color: "#bf360c", letterSpacing: 1, marginBottom: 4, marginTop: 12 },
  returningOtpCode: { fontSize: 30, fontWeight: "900", color: "#fff", letterSpacing: 8, fontVariant: ["tabular-nums"] },
  expiredCard: {
    backgroundColor: "#fff8e1",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#ffe082",
    marginBottom: 22,
  },
  expiredIcon: { fontSize: 32 },
  expiredTitle: { fontSize: 17, fontWeight: "800", color: S, marginTop: 8 },
  expiredSubtitle: { fontSize: 12, color: "#777", textAlign: "center", marginTop: 4, marginBottom: 4 },
  expiredBtnComplete: {
    backgroundColor: Y,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%",
    marginTop: 16,
  },
  expiredBtnCompleteText: { fontSize: 15, fontWeight: "700", color: S },
  expiredBtnReturn: {
    backgroundColor: "transparent",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%",
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: S,
  },
  expiredBtnReturnText: { fontSize: 15, fontWeight: "700", color: S },
});
