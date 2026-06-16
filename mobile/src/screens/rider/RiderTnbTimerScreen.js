import { useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSocket } from "../../api/SocketContext";
import { api } from "../../api/client";

function pad(n) {
  return String(n).padStart(2, "0");
}

function secsRemaining(tryTimerEnd) {
  return Math.max(0, Math.round((new Date(tryTimerEnd).getTime() - Date.now()) / 1000));
}

export default function RiderTnbTimerScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const socket = useSocket();
  const { order: initialOrder } = route.params;

  const [order, setOrder] = useState(initialOrder);
  const [secs, setSecs] = useState(() => secsRemaining(initialOrder.tryTimerEnd));
  const [initiatingReturn, setInitiatingReturn] = useState(false);

  const timerRef = useRef(null);

  // Drive the countdown from the server-supplied tryTimerEnd timestamp
  useEffect(() => {
    if (!order.tryTimerEnd) return;
    timerRef.current = setInterval(() => {
      setSecs(secsRemaining(order.tryTimerEnd));
    }, 500);
    return () => clearInterval(timerRef.current);
  }, [order.tryTimerEnd]);

  // Listen for order_update in case the status changes externally
  useEffect(() => {
    if (!socket) return;
    socket.emit("join_order_room", order.id);
    const handler = ({ order: updated }) => {
      if (updated.id === order.id) setOrder(updated);
    };
    socket.on("order_update", handler);
    return () => socket.off("order_update", handler);
  }, [socket, order.id]);

  const expired = secs <= 0;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;

  async function initiateReturn() {
    Alert.alert(
      "Confirm Return",
      "Customer is returning all items? This will start the return journey.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Return",
          style: "destructive",
          onPress: async () => {
            setInitiatingReturn(true);
            try {
              const { data } = await api.post(`/rider/orders/${order.id}/initiate-return`);
              navigation.replace("RiderReturn", { order: data.data.order });
            } catch (err) {
              Alert.alert("Error", err.response?.data?.error?.message ?? "Failed to initiate return");
            } finally {
              setInitiatingReturn(false);
            }
          },
        },
      ]
    );
  }

  function customerKeeping() {
    navigation.popToTop();
  }

  const ringColor = expired ? "#e53935" : secs <= 5 ? "#ff7043" : Y;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Try &amp; Buy</Text>
        <Text style={styles.subtitle}>
          {expired ? "Time's up — decide now" : "Customer is trying the items"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 160 }]}>
        {/* Timer ring */}
        <View style={[styles.timerRing, { borderColor: ringColor }]}>
          {expired ? (
            <Text style={[styles.timerExpired, { color: "#e53935" }]}>TIME{"\n"}UP</Text>
          ) : (
            <>
              <Text style={[styles.timerCount, { color: ringColor }]}>
                {pad(mins)}:{pad(remainSecs)}
              </Text>
              <Text style={styles.timerSub}>remaining</Text>
            </>
          )}
        </View>

        {/* Order summary */}
        <View style={styles.section}>
          <Text style={styles.label}>DELIVERY ADDRESS</Text>
          <Text style={styles.value}>{order.deliveryAddr}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>ITEMS</Text>
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

        <Text style={styles.hint}>
          Stay near the customer until the timer ends or they make a decision.
        </Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={styles.btnKeep}
          onPress={customerKeeping}
        >
          <Text style={styles.btnKeepText}>Customer Keeping Items ✓</Text>
        </Pressable>

        <Pressable
          style={[styles.btnReturn, initiatingReturn && styles.btnDisabled]}
          onPress={initiateReturn}
          disabled={initiatingReturn}
        >
          {initiatingReturn
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnReturnText}>Customer Returning Items</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const S = "#012a62";
const Y = "#fdde59";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdf9ea" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: "#e8e0cc",
  },
  title: { fontSize: 22, fontWeight: "700", color: S },
  subtitle: { fontSize: 13, color: "#888", marginTop: 3 },
  body: { padding: 16, alignItems: "stretch" },
  timerRing: {
    alignSelf: "center",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 24,
    backgroundColor: "#fff",
  },
  timerCount: { fontSize: 44, fontWeight: "800", letterSpacing: 2 },
  timerSub: { fontSize: 12, color: "#999", marginTop: 2 },
  timerExpired: { fontSize: 28, fontWeight: "800", textAlign: "center", lineHeight: 34 },
  section: { marginBottom: 20 },
  label: { fontSize: 10, fontWeight: "700", color: S, letterSpacing: 1, opacity: 0.5, marginBottom: 6 },
  value: { fontSize: 15, fontWeight: "500", color: S },
  itemRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  qty: { fontSize: 14, fontWeight: "700", color: S, width: 28, marginRight: 8 },
  itemName: { fontSize: 14, fontWeight: "600", color: S },
  itemVariant: { fontSize: 12, color: "#777", marginTop: 2 },
  hint: { fontSize: 12, color: "#aaa", lineHeight: 18, marginTop: 4 },
  footer: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    padding: 16,
    gap: 10,
    backgroundColor: "#fdf9ea",
    borderTopWidth: 1,
    borderColor: "#e8e0cc",
  },
  btnKeep: {
    backgroundColor: Y,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnKeepText: { fontSize: 15, fontWeight: "700", color: S },
  btnReturn: {
    backgroundColor: S,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnReturnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.5 },
});
