import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/customer/HomeScreen";
import SearchScreen from "../screens/customer/SearchScreen";
import CartScreen from "../screens/customer/CartScreen";
import CheckoutScreen from "../screens/customer/CheckoutScreen";
import OrderConfirmScreen from "../screens/customer/OrderConfirmScreen";

const Tab = createBottomTabNavigator();
const CartStack = createNativeStackNavigator();

function CartStackNavigator() {
  return (
    <CartStack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#fdf9ea" }, headerTintColor: "#012a62", headerTitleStyle: { fontWeight: "700" } }}>
      <CartStack.Screen name="Cart"         component={CartScreen}         options={{ title: "My Cart" }} />
      <CartStack.Screen name="Checkout"     component={CheckoutScreen}     options={{ title: "Checkout" }} />
      <CartStack.Screen name="OrderConfirm" component={OrderConfirmScreen} options={{ title: "Order Confirmed", headerLeft: () => null }} />
    </CartStack.Navigator>
  );
}

export default function CustomerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: "#fdf9ea", borderTopColor: "#012a6215" },
        tabBarActiveTintColor: "#012a62",
        tabBarInactiveTintColor: "#012a6250",
        headerStyle: { backgroundColor: "#fdf9ea" },
        headerTintColor: "#012a62",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Tab.Screen name="Home"    component={HomeScreen}         />
      <Tab.Screen name="Search"  component={SearchScreen}       />
      <Tab.Screen name="CartTab" component={CartStackNavigator} options={{ title: "Cart", headerShown: false }} />
    </Tab.Navigator>
  );
}
