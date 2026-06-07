import { View, Text } from "react-native";

// TODO: search bar, filters, results — GET /products?q=&storeId=
export default function SearchScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-lg text-gray-500">Search</Text>
    </View>
  );
}
