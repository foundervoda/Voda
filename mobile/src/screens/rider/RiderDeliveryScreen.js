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
  const [timeLeft, setTimeLeft] = useState("");

  const isTryBuy = order.deliveryAddr?.includes(" | Try & Buy") || order.isTryAndBuy;
  const showTimer = order.status === "DELIVERED" && order.tryTimerRemainingMs > 0;
  const showTimerExpiredChoice = order.status === "DELIVERED" && isTryBuy && !showTimer;

  // Socket listener for real-time status updates (e.g. customer finalizes keeps)
  useEffect(() => {
    if (!socket) return;

    socket.emit("join_order_room", order.id);

    const handleUpdate = ({ order: updatedOrder }) => {
      if (updatedOrder && updatedOrder.id === order.id) {
        setOrder(updatedOrder);
      }
    };

    socket.on("order_update", handleUpdate);

    return () => {
      socket.off("order_update", handleUpdate);
    };
  }, [socket, order.id]);

  // Synchronized timer countdown
  useEffect(() => {
    if (!showTimer || !order.tryTimerRemainingMs) return;

    const startMs = Date.now();
    const remainingMs = order.tryTimerRemainingMs;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startMs;
      const diff = remainingMs - elapsed;

      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeft("00:00");
        // Reload order state
        api.get(`/orders/${order.id}`).then((res) => {
          setOrder(res.data.data.order);
        });
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        const formatNum = (num) => (num < 10 ? `0${num}` : num);
        setTimeLeft(`${formatNum(minutes)}:${formatNum(seconds)}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order.tryTimerRemainingMs, showTimer]);

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
    if (isTryBuy && !otpInput.trim()) {
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

  const closeDelivery = () => {
    navigation.popToTop();
  };

  const initiateReturn = () => {
    Alert.alert(
      "Confirm Return",
      "Is the customer returning all items?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Return",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const { data } = await api.post(`/rider/orders/${order.id}/initiate-return`);
              setOrder(data.data.order);
            } catch (err) {
              Alert.alert("Error", err.response?.data?.error?.message ?? "Could not initiate return");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const completeReturn = () => {
    Alert.alert(
      "Confirm Return Complete",
      "Have you returned the items to the store?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setLoading(true);
            try {
              await api.post(`/rider/orders/${order.id}/complete-return`);
              navigation.popToTop();
            } catch (err) {
              Alert.alert("Error", err.response?.data?.error?.message ?? "Could not complete return");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
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

        {/* Sync Countdown Clock */}
        {showTimer && (
          <>
            <View style={styles.timerCard}>
              <Ionicons name="time" size={32} color="#012a62" />
              <Text style={styles.timerLabel}>Try & Buy Timer Active</Text>
              <Text style={styles.timerClock}>{timeLeft || "--:--"}</Text>
              <Text style={styles.timerHint}>
                Customer is trying items at their doorstep. Timer is synchronized.
              </Text>
            </View>
            <Pressable style={styles.returnBtn} onPress={initiateReturn} disabled={loading}>
              <Text style={styles.returnBtnText}>↩  Customer Returning Items</Text>
            </Pressable>
          </>
        )}

        {/* Return in progress */}
        {order.status === "RETURNING" && (
          <View style={styles.returningCard}>
            <Text style={styles.returningIcon}>↩</Text>
            <Text style={styles.returningTitle}>Return in Progress</Text>
            <Text style={styles.returningSubtitle}>
              Take the items back to the store and confirm below.
            </Text>
            <Pressable style={[styles.btn, { marginTop: 16, width: "100%" }]} onPress={completeReturn} disabled={loading}>
              {loading
                ? <ActivityIndicator color={S} />
                : <Text style={styles.btnText}>I'm Back at the Store</Text>}
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
            {isTryBuy ? (
              <View style={{ width: "100%", marginBottom: 16 }}>
                <Text style={styles.otpLabel}>ENTER CUSTOMER HANDOVER OTP</Text>
                <TextInput
                  style={styles.otpInput}
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
            ) : (
              <Text style={styles.stdHint}>Standard delivery. No OTP required.</Text>
            )}
            <Pressable style={styles.btn} onPress={verifyOtp} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#012a62" />
              ) : (
                <Text style={styles.btnText}>{isTryBuy ? "Verify OTP & Start Trial" : "Confirm Handover"}</Text>
              )}
            </Pressable>
          </View>
        )}

        {showTimerExpiredChoice && (
          <View style={styles.expiredCard}>
            <Text style={styles.expiredIcon}>⏰</Text>
            <Text style={styles.expiredTitle}>Try & Buy Time's Up</Text>
            <Text style={styles.expiredSubtitle}>What did the customer decide?</Text>
            <Pressable style={styles.expiredBtnComplete} onPress={closeDelivery} disabled={loading}>
              <Text style={styles.expiredBtnCompleteText}>Order Complete — Keeps All</Text>
            </Pressable>
            <Pressable style={styles.expiredBtnReturn} onPress={initiateReturn} disabled={loading}>
              {loading
                ? <ActivityIndicator color={S} />
                : <Text style={styles.expiredBtnReturnText}>Return to Mall</Text>}
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
  returnBtn: {
    backgroundColor: S,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 22,
  },
  returnBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
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
