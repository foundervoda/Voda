import { useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";

export default function RiderDeliveryScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { order } = route.params;
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);
    try {
      const { data } = await api.post(`/rider/orders/${order.id}/accept`);
      navigation.replace("RiderDelivery", { order: data.data.order });
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error?.message ?? "Failed to accept order");
    } finally {
      setLoading(false);
    }
  }

  async function markArrived() {
    setLoading(true);
    try {
      const { data } = await api.post(`/rider/orders/${order.id}/arrive`);
      navigation.replace("RiderArrived", { order: data.data.order, otp: data.data.otp });
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error?.message ?? "Failed to mark arrived");
    } finally {
      setLoading(false);
    }
  }

  const isAccepted = order.status === "OUT_FOR_DELIVERY";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>
          {isAccepted ? "Active Delivery" : "Order Details"}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 110 }]}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {isAccepted ? "Out for Delivery" : "Awaiting Acceptance"}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>DELIVERY ADDRESS</Text>
          <Text style={styles.value}>{order.deliveryAddr}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>CUSTOMER</Text>
          <Text style={styles.value}>{order.customer?.phone ?? "—"}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>ITEMS IN BAG</Text>
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

        <View style={styles.section}>
          <Text style={styles.label}>ETA</Text>
          <Text style={styles.value}>{order.etaMinutes} min</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {isAccepted ? (
          <Pressable
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={markArrived}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={S} />
              : <Text style={styles.btnText}>I've Arrived at Customer</Text>}
          </Pressable>
        ) : (
          <Pressable
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={accept}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={S} />
              : <Text style={styles.btnText}>Accept & Start Delivery</Text>}
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
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: "#e8e0cc",
  },
  back: { fontSize: 14, color: S, width: 60 },
  title: { fontSize: 18, fontWeight: "700", color: S, textAlign: "center" },
  body: { padding: 16 },
  statusBadge: {
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 22,
    alignItems: "center",
  },
  statusText: { fontSize: 14, fontWeight: "600", color: "#2e7d32" },
  section: { marginBottom: 22 },
  label: { fontSize: 10, fontWeight: "700", color: S, letterSpacing: 1, opacity: 0.5, marginBottom: 6 },
  value: { fontSize: 15, fontWeight: "500", color: S },
  itemRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  qty: { fontSize: 15, fontWeight: "700", color: S, width: 30, marginRight: 8 },
  itemName: { fontSize: 15, fontWeight: "600", color: S },
  itemVariant: { fontSize: 13, color: "#777", marginTop: 2 },
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
  btnText: { fontSize: 16, fontWeight: "700", color: S },
});
