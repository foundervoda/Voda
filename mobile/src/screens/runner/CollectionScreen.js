import { useState, useEffect, useCallback } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../../api/client";

export default function CollectionScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { order } = route.params;
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(new Set());
  const [kioskDone, setKioskDone] = useState(false);

  const fetchKioskStatus = useCallback(async () => {
    try {
      const { data } = await api.get(`/runner/orders/${order.id}`);
      setKioskDone(data.data.order?.kioskVerified ?? false);
    } catch {}
  }, [order.id]);

  useFocusEffect(useCallback(() => { fetchKioskStatus(); }, [fetchKioskStatus]));

  const allChecked = order.items.length > 0 && checked.size === order.items.length;
  const canCollect = allChecked && kioskDone;

  function toggleItem(id) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function markCollected() {
    if (!kioskDone) {
      Alert.alert("Kiosk scan required", `Please scan order #${order.id.slice(-6).toUpperCase()} at the kiosk before collecting.`);
      return;
    }
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
        <Text style={styles.subtitle}>Verify all items are in the package</Text>
      </View>

      <View style={styles.storeBox}>
        <Text style={styles.storeLabel}>PICK UP — STORE ADDRESS</Text>
        <Text style={styles.storeAddr}>{order.deliveryAddr}</Text>
      </View>

      <View style={[styles.kioskBanner, kioskDone ? styles.kioskDone : styles.kioskPending]}>
        <Ionicons
          name={kioskDone ? "checkmark-circle" : "scan-outline"}
          size={18}
          color={kioskDone ? "#16a34a" : "#b45309"}
        />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.kioskBannerTitle, { color: kioskDone ? "#14532d" : "#78350f" }]}>
            {kioskDone ? "Kiosk scan complete" : "Kiosk scan required"}
          </Text>
          <Text style={[styles.kioskBannerSub, { color: kioskDone ? "#16a34a" : "#b45309" }]}>
            {kioskDone
              ? "All items verified at the kiosk"
              : `Go to the kiosk and enter order #${order.id.slice(-6).toUpperCase()}`}
          </Text>
        </View>
        {!kioskDone && (
          <Pressable onPress={fetchKioskStatus} hitSlop={8}>
            <Ionicons name="refresh" size={18} color="#b45309" />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 80 }]}>
        <Text style={styles.sectionLabel}>ITEMS CHECKLIST</Text>
        {order.items.map((item) => {
          const isChecked = checked.has(item.id);
          return (
            <Pressable key={item.id} style={styles.itemRow} onPress={() => toggleItem(item.id)}>
              <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                {isChecked && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, isChecked && styles.itemNameChecked]}>
                  {item.product.name}
                </Text>
                <Text style={styles.itemVariant}>
                  {item.quantity}× · {item.variant.size}
                  {item.variant.color ? ` · ${item.variant.color}` : ""}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.btn, (!canCollect || loading) && styles.btnDisabled]}
          onPress={markCollected}
          disabled={!canCollect || loading}
        >
          {loading ? (
            <ActivityIndicator color="#012a62" />
          ) : (
            <Text style={styles.btnText}>
              {!allChecked
                ? `Check all items (${checked.size}/${order.items.length})`
                : !kioskDone
                ? "Kiosk scan required first"
                : "Mark as Collected"}
            </Text>
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
  kioskBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  kioskDone: { backgroundColor: "#f0fdf4", borderColor: "#86efac" },
  kioskPending: { backgroundColor: "#fffbeb", borderColor: "#fcd34d" },
  kioskBannerTitle: { fontSize: 13, fontWeight: "700" },
  kioskBannerSub: { fontSize: 11, marginTop: 1 },
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
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: S,
    marginRight: 12,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: S, borderColor: S },
  itemName: { fontSize: 15, fontWeight: "600", color: S },
  itemNameChecked: { opacity: 0.4 },
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
