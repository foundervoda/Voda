import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";

export default function AcceptOrderScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { order } = route.params;
  const [loading, setLoading] = useState(false);

  const store = order.items[0]?.product?.store ?? null;

  async function accept() {
    setLoading(true);
    try {
      const { data } = await api.post(`/runner/orders/${order.id}/assign`);
      navigation.replace("Collection", { order: data.data.order });
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error?.message ?? "Failed to accept order");
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
        <Text style={styles.title}>Order Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 100 }]}>

        {/* Order ID */}
        <View style={styles.section}>
          <Text style={styles.label}>ORDER ID</Text>
          <Text style={styles.value}>#{order.id.slice(-8).toUpperCase()}</Text>
        </View>

        {/* Store Info */}
        {store && (
          <View style={styles.storeCard}>
            <View style={styles.storeCardHeader}>
              <Ionicons name="storefront" size={16} color="#fdde59" />
              <Text style={styles.storeCardTitle}>COLLECT FROM</Text>
            </View>
            <Text style={styles.storeName}>{store.name}</Text>
            <View style={styles.storeDetail}>
              <Ionicons name="location-outline" size={14} color="#fdde59" style={{ marginRight: 6 }} />
              <Text style={styles.storeDetailText}>{store.location}</Text>
            </View>
            {store.phone ? (
              <View style={styles.storeDetail}>
                <Ionicons name="call-outline" size={14} color="#fdde59" style={{ marginRight: 6 }} />
                <Text style={styles.storeDetailText}>{store.phone}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Items to collect */}
        <View style={styles.section}>
          <Text style={styles.label}>ITEMS TO COLLECT</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.qtyBadge}>
                <Text style={styles.qtyText}>{item.quantity}</Text>
              </View>
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

        {/* Delivery address */}
        <View style={styles.section}>
          <Text style={styles.label}>DELIVER TO</Text>
          <Text style={styles.value}>{order.deliveryAddr}</Text>
        </View>

        {/* Customer contact */}
        <View style={styles.section}>
          <Text style={styles.label}>CUSTOMER CONTACT</Text>
          <Text style={styles.value}>{order.customer.phone}</Text>
        </View>

      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={accept}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#012a62" />
          ) : (
            <Text style={styles.btnText}>Accept Order</Text>
          )}
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
  value: { fontSize: 15, fontWeight: "500", color: S },

  storeCard: {
    backgroundColor: S,
    borderRadius: 12,
    padding: 16,
    marginBottom: 22,
  },
  storeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  storeCardTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: Y,
    letterSpacing: 1,
    marginLeft: 6,
  },
  storeName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  storeDetail: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  storeDetailText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#ffffff99",
  },

  itemRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  qtyBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: S,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 1,
  },
  qtyText: { fontSize: 13, fontWeight: "800", color: Y },
  itemName: { fontSize: 15, fontWeight: "600", color: S },
  itemVariant: { fontSize: 13, color: "#777", marginTop: 2 },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#fdf9ea",
    borderTopWidth: 1,
    borderColor: "#e8e0cc",
  },
  btn: { backgroundColor: Y, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: "700", color: S },
});
