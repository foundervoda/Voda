import { View, Text, Pressable, StyleSheet, ScrollView, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toRupees, formatRupees as formatRupeePrice } from "../../utils/price";

export default function OrderConfirmScreen({ route, navigation }) {
  const { order } = route.params;

  // Compute subtotal from the total amount and returned fees
  const deliveryFee = order.deliveryFee ?? 0;
  const tryAndBuyFee = order.tryAndBuyFee ?? 0;
  const totalAmount = order.totalAmount ?? 0;
  const subtotal = totalAmount - deliveryFee - tryAndBuyFee;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" />

      {/* Success Icon */}
      <View style={s.iconWrap}>
        <Ionicons name="checkmark" size={40} color="#fdde59" />
      </View>

      <Text style={s.heading}>Order Placed!</Text>
      <Text style={s.sub}>Your runner has been notified and is preparing your items.</Text>

      {/* Delivery Status Card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Delivery Details</Text>
        <Row label="Order ID" value={`#${order.id.slice(0, 8).toUpperCase()}`} />
        <Row label="Status"   value={order.status} isStatus />
        <Row label="ETA"      value={`~${order.etaMinutes} mins`} />
        <Row label="Address"  value={order.deliveryAddr} />
      </View>

      {/* Items Summary Card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Items Ordered</Text>
        {order.items.map((item) => (
          <View key={item.id} style={s.itemRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={s.itemName}>
                {item.product.name}
              </Text>
              {item.variant?.size && (
                <Text style={s.itemSize}>Size: {item.variant.size}</Text>
              )}
            </View>
            <Text style={s.itemQty}>× {item.quantity}</Text>
            <Text style={s.itemPrice}>₹{formatRupeePrice(toRupees(item.product.price) * item.quantity)}</Text>
          </View>
        ))}
      </View>

      {/* Payment Details / Pricing Card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Payment Details</Text>
        <Row label="Subtotal" value={`₹${formatRupeePrice(subtotal)}`} />
        
        <View style={s.row}>
          <Text style={s.rowLabel}>Delivery Fee</Text>
          {deliveryFee === 0 ? (
            <Text style={s.freeText}>FREE ({order.isPlatinum ? "Platinum" : "Gold"})</Text>
          ) : (
            <Text style={s.rowValue}>₹{formatRupeePrice(deliveryFee)}</Text>
          )}
        </View>

        {(order.isGold || order.isPlatinum) && (
          <View style={s.row}>
            <Text style={s.rowLabel}>Try & Buy Option</Text>
            {order.isTryAndBuy ? (
              <Text style={s.freeText}>Active ({order.isPlatinum ? "Platinum" : "Gold"} - FREE)</Text>
            ) : (
              <Text style={s.inactiveText}>Not available for these items</Text>
            )}
          </View>
        )}

        <View style={s.divider} />
        
        <View style={s.row}>
          <Text style={s.totalLabel}>Total Paid</Text>
          <Text style={s.totalValue}>₹{formatRupeePrice(totalAmount)}</Text>
        </View>
      </View>

      {/* Track Order */}
      <Pressable style={s.btn} onPress={() => navigation.replace("TrackOrder", { order })}>
        <Ionicons name="navigate" size={18} color="#012a62" style={{ marginRight: 8 }} />
        <Text style={s.btnText}>Track My Order</Text>
      </Pressable>

      {/* Back to Home Button */}
      <Pressable style={[s.btn, s.btnSecondary]} onPress={() => navigation.navigate("CustomerTabs")}>
        <Text style={[s.btnText, { color: "#012a6280" }]}>Back to Mall Directory</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value, isStatus }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, isStatus && s.statusText]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: "#fdf9ea" },
  content:   { padding: 20, alignItems: "center", paddingBottom: 40 },
  iconWrap:  { width: 72, height: 72, borderRadius: 36, backgroundColor: "#012a62", alignItems: "center", justifyContent: "center", marginBottom: 16, marginTop: 20 },
  heading:   { fontSize: 24, fontWeight: "800", color: "#012a62", marginBottom: 6 },
  sub:       { fontSize: 13, color: "#012a6270", textAlign: "center", marginBottom: 24, paddingHorizontal: 20, fontWeight: "600", lineHeight: 18 },
  card:      { width: "100%", backgroundColor: "#fffef5", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#012a6208", marginBottom: 16, shadowColor: "#012a62", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#012a62", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 },
  row:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  rowLabel:  { color: "#012a6270", fontSize: 13, fontWeight: "600" },
  rowValue:  { color: "#012a62", fontSize: 13, fontWeight: "700", flex: 1, textAlign: "right" },
  statusText: { textTransform: "uppercase", color: "#e59f00" },
  itemRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#012a6205", paddingBottom: 8 },
  itemName:  { color: "#012a62", fontSize: 13, fontWeight: "700" },
  itemSize:  { color: "#012a6260", fontSize: 11, fontWeight: "600", marginTop: 2 },
  itemQty:   { color: "#012a6270", fontSize: 13, fontWeight: "600", marginRight: 16 },
  itemPrice: { color: "#012a62", fontSize: 13, fontWeight: "700" },
  divider:   { height: 1, backgroundColor: "#012a620c", marginVertical: 12 },
  totalLabel: { color: "#012a62", fontSize: 15, fontWeight: "800" },
  totalValue: { color: "#012a62", fontSize: 16, fontWeight: "900" },
  freeText:   { color: "#16a34a", fontSize: 13, fontWeight: "800", flex: 1, textAlign: "right" },
  activeText: { color: "#012a62", fontSize: 13, fontWeight: "700", flex: 1, textAlign: "right" },
  inactiveText: { color: "#dc2626", fontSize: 13, fontWeight: "700", flex: 1, textAlign: "right" },
  btn:         { marginTop: 8, backgroundColor: "#fdde59", borderColor: "#012a62", borderWidth: 1.5, borderRadius: 14, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", width: "100%", shadowColor: "#012a62", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  btnSecondary:{ backgroundColor: "transparent", borderColor: "#012a6220", shadowOpacity: 0, elevation: 0 },
  btnText:     { color: "#012a62", fontWeight: "900", fontSize: 16 },
});
