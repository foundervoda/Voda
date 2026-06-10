import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useAuthStore } from "../store/useAuthStore";
import AuthNavigator from "./AuthNavigator";
import CustomerTabs from "./CustomerTabs";
import ProductDetailScreen from "../screens/customer/ProductDetailScreen"; // 👈 Added your screen import
import { SocketProvider } from "../api/SocketContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Change this to false whenever you want to test the normal Login screen again!
const SIMULATE_PRODUCT_SCREEN = false;

// Switches between the auth stack and the actor's app shell based on session state
export default function RootNavigator() {
  const { user, isLoading, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {SIMULATE_PRODUCT_SCREEN ? (
        <SafeAreaProvider>
          <ProductDetailScreen />
        </SafeAreaProvider>
      ) : user ? (
        <SocketProvider>
          <CustomerTabs />
        </SocketProvider>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}