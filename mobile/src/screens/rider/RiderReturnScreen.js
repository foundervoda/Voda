import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RiderReturnScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { order } = route.params;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Return Initiated</Text>
        <Text style={styles.subtitle}>Hand the package to a runner</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 110 }]}>
        <View style={styles.returnBadge}>
          <Text style={styles.returnIcon}>↩</Text>
          <Text style={styles.returnText}>Awaiting Runner Pickup</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Give the package to an available runner. A runner will collect it and return it to the store on your behalf.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>ITEMS TO HAND OVER</Text>
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
  title: { fontSize: 22, fontWeight: "700", color: S },
  subtitle: { fontSize: 13, color: "#888", marginTop: 3 },
  body: { padding: 16 },
  returnBadge: {
    backgroundColor: "#fff3e0",
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  returnIcon: { fontSize: 24, color: "#e65100" },
  returnText: { fontSize: 16, fontWeight: "700", color: "#e65100" },
  section: { marginBottom: 22 },
  label: { fontSize: 10, fontWeight: "700", color: S, letterSpacing: 1, opacity: 0.5, marginBottom: 6 },
  value: { fontSize: 15, fontWeight: "500", color: S },
  itemRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  qty: { fontSize: 14, fontWeight: "700", color: S, width: 28, marginRight: 8 },
  itemName: { fontSize: 14, fontWeight: "600", color: S },
  itemVariant: { fontSize: 12, color: "#777", marginTop: 2 },
  infoBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e8e0cc",
    marginTop: 4,
  },
  infoText: { fontSize: 13, color: "#666", lineHeight: 20 },
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
  btnText: { fontSize: 15, fontWeight: "700", color: S, textAlign: "center" },
});
