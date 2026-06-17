import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/customer/HomeScreen";
import StoreCatalogScreen from "../screens/customer/StoreCatalogScreen";
import ProfileScreen from "../screens/customer/ProfileScreen";
import { Ionicons } from "@expo/vector-icons";
import { useOrderStore } from "../store/useOrderStore";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function DirectoryStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="StoresList" 
        component={HomeScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="StoreCatalog" 
        component={StoreCatalogScreen} 
        options={({ route }) => ({
          headerShown: true,
          title: route.params?.store?.name || "Store",
          headerTintColor: "#0d1b5e",
          headerStyle: { backgroundColor: "#ffffff" },
          headerTitleStyle: { fontWeight: "900", fontSize: 18 },
          headerShadowVisible: false,
          headerBackTitle: "Stores", // iOS standard back text
        })}
      />
    </Stack.Navigator>
  );
}

export default function CustomerTabs() {
  const cart = useOrderStore((state) => state.cart);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => {
          let iconName;
          if (route.name === "MallDirectory") {
            iconName = focused ? "business" : "business-outline";
          } else if (route.name === "CustomerProfile") {
            iconName = focused ? "person" : "person-outline";
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#f1f5f9", // Crisp slate-100 border
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 2,
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 4,
        },
        tabBarActiveTintColor: "#0D1B5E", // Voda Navy
        tabBarInactiveTintColor: "#94A3B8", // Slate
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="MallDirectory" 
        component={DirectoryStack} 
        options={{ 
          tabBarLabel: "Stores" 
        }} 
      />
      <Tab.Screen 
        name="CustomerProfile" 
        component={ProfileScreen} 
        options={{ 
          tabBarLabel: "Profile",
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: "#dc2626", // Red badge
            color: "#ffffff",
            fontSize: 10,
            fontWeight: "bold",
          }
        }} 
      />
    </Tab.Navigator>
  );
}

