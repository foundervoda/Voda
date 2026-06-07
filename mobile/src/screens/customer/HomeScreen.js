import { View, Text } from "react-native";

// TODO: trending grid + category tabs, fetched from GET /products?trending=true
export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-lg text-gray-500">Home — trending products</Text>
    </View>
  );
}
