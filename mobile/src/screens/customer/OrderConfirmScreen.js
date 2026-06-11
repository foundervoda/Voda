import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";

export default function OrderConfirmScreen({ route, navigation }) {
  const { order } = route.params;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.iconWrap}>
        <Text style={s.icon}>✓</Text>
      </View>

      <Text style={s.heading}>Order placed!</Text>
      <Text style={s.sub}>We've sent your order to the store.</Text>

      <View style={s.card}>
        <Row label="Order ID" value={`#${order.id.slice(0, 8).toUpperCase()}`} />
        <Row label="Status"   value={order.status} />
        <Row label="ETA"      value={`~${order.etaMinutes} min`} />
        <Row label="Deliver to" value={order.deliveryAddr} />
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Items</Text>
        {order.items.map((item) => (
          <View key={item.id} style={s.itemRow}>
            <Text style={s.itemName}>
              {item.product.name}
              {item.variant?.size ? ` — Size ${item.variant.size}` : ""}
            </Text>
            <Text style={s.itemQty}>× {item.quantity}</Text>
          </View>
        ))}
      </View>

      <Pressable style={s.btn} onPress={() => navigation.navigate("CustomerTabs", { screen: "HomeTab" })}>
        <Text style={s.btnText}>Back to Home</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: "#fdf9ea" },
  content:   { padding: 24, alignItems: "center" },
  iconWrap:  { width: 72, height: 72, borderRadius: 36, backgroundColor: "#012a62", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  icon:      { color: "#fdde59", fontSize: 36, fontWeight: "700" },
  heading:   { fontSize: 26, fontWeight: "700", color: "#012a62", marginBottom: 6 },
  sub:       { fontSize: 15, color: "#012a6270", marginBottom: 28 },
  card:      { width: "100%", backgroundColor: "#fffef5", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#012a6215", marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#012a62", marginBottom: 12 },
  row:       { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  rowLabel:  { color: "#012a6270", fontSize: 14 },
  rowValue:  { color: "#012a62", fontSize: 14, fontWeight: "600", flex: 1, textAlign: "right" },
  itemRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  itemName:  { color: "#012a62", fontSize: 14, flex: 1 },
  itemQty:   { color: "#012a6270", fontSize: 14 },
  btn:       { marginTop: 8, backgroundColor: "#012a62", borderRadius: 12, paddingVertical: 15, alignItems: "center", width: "100%" },
  btnText:   { color: "#fdde59", fontWeight: "700", fontSize: 16 },
});
