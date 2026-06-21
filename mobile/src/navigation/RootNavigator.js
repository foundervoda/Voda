import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import ActiveOrderBanner from "../components/ActiveOrderBanner";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "../store/useAuthStore";
import AuthNavigator from "./AuthNavigator";
import CustomerTabs from "./CustomerTabs";
import ProductDetailScreen from "../screens/customer/ProductDetailScreen";
import CartScreen from "../screens/customer/CartScreen";
import CheckoutScreen from "../screens/customer/CheckoutScreen";
import OrderConfirmScreen from "../screens/customer/OrderConfirmScreen";
import VodaGoldScreen from "../screens/customer/VodaGoldScreen";
import TryBuyScreen from "../screens/customer/TryBuyScreen";
import TrackOrderScreen from "../screens/customer/TrackOrderScreen";
import OrderHistoryScreen from "../screens/customer/OrderHistoryScreen";
import RunnerNavigator from "./RunnerNavigator";
import { SocketProvider } from "../api/SocketContext";

const Stack = createNativeStackNavigator();

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

  return user ? (
    <SocketProvider>
      {user.role === "RUNNER" || user.role === "RIDER" ? (
        <RunnerNavigator />
      ) : (
      <View style={StyleSheet.absoluteFill}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen 
          name="Cart" 
          component={CartScreen} 
          options={{ 
            headerShown: true, 
            title: "My Cart", 
            headerStyle: { backgroundColor: "#fdf9ea" }, 
            headerTintColor: "#012a62", 
            headerTitleStyle: { fontWeight: "700" } 
          }} 
        />
        <Stack.Screen 
          name="Checkout" 
          component={CheckoutScreen} 
          options={{ 
            headerShown: true, 
            title: "Checkout", 
            headerStyle: { backgroundColor: "#fdf9ea" }, 
            headerTintColor: "#012a62", 
            headerTitleStyle: { fontWeight: "700" } 
          }} 
        />
        <Stack.Screen 
          name="OrderConfirm" 
          component={OrderConfirmScreen} 
          options={{ 
            headerShown: true, 
            title: "Order Confirmed", 
            headerLeft: () => null,
            headerStyle: { backgroundColor: "#fdf9ea" }, 
            headerTintColor: "#012a62", 
            headerTitleStyle: { fontWeight: "700" } 
          }} 
        />
        <Stack.Screen 
          name="VodaGold" 
          component={VodaGoldScreen} 
          options={{ 
            headerShown: false,
          }} 
        />
        <Stack.Screen 
          name="TryBuy" 
          component={TryBuyScreen} 
          options={{ 
            headerShown: false,
          }} 
        />
        <Stack.Screen 
          name="TrackOrder" 
          component={TrackOrderScreen} 
          options={{ 
            headerShown: false,
          }} 
        />
        <Stack.Screen 
          name="OrderHistory" 
          component={OrderHistoryScreen} 
          options={{ 
            headerShown: false,
          }} 
        />
      </Stack.Navigator>
      <ActiveOrderBanner />
      </View>
      )}
    </SocketProvider>
  ) : (
    <AuthNavigator />
  );
}