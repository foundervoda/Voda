import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useOrderStore } from "../../store/useOrderStore";

export default function CheckoutScreen({ navigation }) {
  const { cart, placeOrder } = useOrderStore();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!address.trim()) {
      setError("Please enter a delivery address");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const order = await placeOrder(address.trim());
      navigation.replace("OrderConfirm", { order });
    } catch (err) {
      setError(err?.response?.data?.error?.message ?? "Could not place order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.heading}>Checkout</Text>

      <Text style={s.label}>Delivery address</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. Gate 3, Block B, Apartment 12"
        placeholderTextColor="#012a6260"
        value={address}
        onChangeText={setAddress}
        multiline
      />

      <View style={s.summaryBox}>
        <Text style={s.summaryTitle}>Order summary</Text>
        {cart.map((item) => (
          <View key={item.variantId} style={s.summaryRow}>
            <Text style={s.summaryItem}>{item.name}{item.size ? ` (${item.size})` : ""} × {item.quantity}</Text>
            <Text style={s.summaryPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
          </View>
        ))}
        <View style={s.divider} />
        <View style={s.summaryRow}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalAmt}>${total.toFixed(2)}</Text>
        </View>
      </View>

      <View style={s.paymentBox}>
        <Text style={s.paymentTitle}>Payment</Text>
        <Text style={s.paymentNote}>Mock payment — no card needed for prototype</Text>
        <View style={s.mockCard}>
          <Text style={s.mockCardText}>💳  •••• •••• •••• 4242</Text>
        </View>
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <Pressable style={[s.btn, loading && s.btnDisabled]} onPress={handlePlaceOrder} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fdde59" />
        ) : (
          <Text style={s.btnText}>Place Order</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: "#fdf9ea" },
  content:      { padding: 24 },
  heading:      { fontSize: 24, fontWeight: "700", color: "#012a62", marginBottom: 24 },
  label:        { fontSize: 14, fontWeight: "600", color: "#012a62", marginBottom: 6 },
  input:        { borderWidth: 1, borderColor: "#012a6240", borderRadius: 12, padding: 14, fontSize: 15, color: "#012a62", backgroundColor: "#fffef5", marginBottom: 20, minHeight: 60 },
  summaryBox:   { backgroundColor: "#fffef5", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#012a6215", marginBottom: 16 },
  summaryTitle: { fontSize: 15, fontWeight: "700", color: "#012a62", marginBottom: 12 },
  summaryRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  summaryItem:  { color: "#012a62", fontSize: 14, flex: 1, marginRight: 8 },
  summaryPrice: { color: "#012a62", fontSize: 14, fontWeight: "600" },
  divider:      { height: 1, backgroundColor: "#012a6215", marginVertical: 8 },
  totalLabel:   { color: "#012a62", fontSize: 16, fontWeight: "700" },
  totalAmt:     { color: "#012a62", fontSize: 16, fontWeight: "700" },
  paymentBox:   { backgroundColor: "#fffef5", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#012a6215", marginBottom: 24 },
  paymentTitle: { fontSize: 15, fontWeight: "700", color: "#012a62", marginBottom: 4 },
  paymentNote:  { fontSize: 13, color: "#012a6270", marginBottom: 12 },
  mockCard:     { backgroundColor: "#012a62", borderRadius: 8, padding: 14 },
  mockCardText: { color: "#fdde59", fontWeight: "600", fontSize: 15 },
  error:        { color: "#dc2626", marginBottom: 12, fontSize: 13 },
  btn:          { backgroundColor: "#012a62", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: "#fdde59", fontWeight: "700", fontSize: 16 },
});
