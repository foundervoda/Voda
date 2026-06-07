import { View, Text } from "react-native";
import { useOrderStore } from "../../store/useOrderStore";

// TODO: item list, total, delivery estimate — local Zustand cart state
export default function CartScreen() {
  const cart = useOrderStore((s) => s.cart);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-lg text-gray-500">Cart ({cart.length} items)</Text>
    </View>
  );
}
