import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function HandoverScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { order } = route.params;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Hand Over to Rider</Text>
        <Text style={styles.subtitle}>Pass the bag and confirm once the rider signs off</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 100 }]}>
        <View style={styles.collectedBadge}>
          <Text style={styles.collectedText}>Items Collected ✓</Text>
        </View>

        {order.deliveryOtp ? (
          <View style={styles.otpCard}>
            <Text style={styles.otpLabel}>GIVE THIS CODE TO THE RIDER</Text>
            <Text style={styles.otpCode}>{order.deliveryOtp}</Text>
            <Text style={styles.otpHint}>The rider must enter this code to claim the package.</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.label}>DELIVERY ADDRESS</Text>
          <Text style={styles.value}>{order.deliveryAddr}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>ITEMS IN BAG</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.qty}>{item.quantity}×</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.product.name}</Text>
                <Text style={styles.itemVariant}>
                  {item.variant.size}
                  {item.variant.color ? ` · ${item.variant.color}` : ""}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.hint}>
          Show the code above to the rider. They will enter it on their device to claim the package.
          Once they confirm, you're done.
        </Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={styles.btn} onPress={() => navigation.popToTop()}>
          <Text style={styles.btnText}>Done — Back to Dashboard</Text>
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
  body: { padding: 16 },
  collectedBadge: {
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 22,
    alignItems: "center",
  },
  collectedText: { fontSize: 15, fontWeight: "600", color: "#2e7d32" },
  section: { marginBottom: 22 },
  label: { fontSize: 10, fontWeight: "700", color: S, letterSpacing: 1, opacity: 0.5, marginBottom: 6 },
  value: { fontSize: 15, fontWeight: "500", color: S },
  itemRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  qty: { fontSize: 15, fontWeight: "700", color: S, width: 30, marginRight: 8 },
  itemName: { fontSize: 15, fontWeight: "600", color: S },
  itemVariant: { fontSize: 13, color: "#777", marginTop: 2 },
  otpCard: {
    backgroundColor: S,
    borderRadius: 12,
    padding: 16,
    marginBottom: 22,
    alignItems: "center",
  },
  otpLabel: { fontSize: 10, fontWeight: "800", color: Y, letterSpacing: 1, marginBottom: 8 },
  otpCode: { fontSize: 36, fontWeight: "900", color: "#fff", letterSpacing: 8, fontVariant: ["tabular-nums"], marginBottom: 6 },
  otpHint: { fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center" },
  hint: { fontSize: 13, color: "#999", lineHeight: 20, marginTop: 4 },
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
