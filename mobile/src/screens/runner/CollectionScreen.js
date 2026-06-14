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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";

export default function CollectionScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { order } = route.params;
  const [loading, setLoading] = useState(false);

  async function markCollected() {
    setLoading(true);
    try {
      const { data } = await api.post(`/runner/orders/${order.id}/collect`);
      navigation.replace("Handover", { order: data.data.order });
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error?.message ?? "Failed to mark as collected");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Collect Items</Text>
        <Text style={styles.subtitle}>Verify all items before confirming</Text>
      </View>

      <View style={styles.storeBox}>
        <Text style={styles.storeLabel}>PICK UP — STORE ADDRESS</Text>
        <Text style={styles.storeAddr}>{order.deliveryAddr}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 100 }]}>
        <Text style={styles.sectionLabel}>ITEMS CHECKLIST</Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.checkbox} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.product.name}</Text>
              <Text style={styles.itemVariant}>
                {item.quantity}× ·{" "}
                {item.variant.size}
                {item.variant.color ? ` · ${item.variant.color}` : ""}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={markCollected}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#012a62" />
          ) : (
            <Text style={styles.btnText}>Mark as Collected</Text>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: "#e8e0cc",
  },
  title: { fontSize: 20, fontWeight: "700", color: S },
  subtitle: { fontSize: 13, color: "#888", marginTop: 2 },
  storeBox: { backgroundColor: S, marginHorizontal: 16, marginTop: 14, borderRadius: 10, padding: 14 },
  storeLabel: { fontSize: 10, fontWeight: "700", color: Y, letterSpacing: 1, marginBottom: 4 },
  storeAddr: { fontSize: 15, fontWeight: "600", color: "#fff" },
  body: { padding: 16 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: S,
    letterSpacing: 1,
    opacity: 0.5,
    marginBottom: 14,
  },
  itemRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: S,
    marginRight: 12,
    marginTop: 2,
  },
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
