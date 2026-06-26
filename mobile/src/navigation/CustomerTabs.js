import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/customer/HomeScreen";
import StoreCatalogScreen from "../screens/customer/StoreCatalogScreen";
import SearchScreen from "../screens/customer/SearchScreen";
import VodaGoldScreen from "../screens/customer/VodaGoldScreen";
import ProfileScreen from "../screens/customer/ProfileScreen";
import { Ionicons } from "@expo/vector-icons";
import { useOrderStore } from "../store/useOrderStore";
import { View, Text, StyleSheet } from "react-native";

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
          headerTintColor: "#000000",
          headerStyle: { backgroundColor: "#f2f2f7" },
          headerTitleStyle: { fontWeight: "600", fontSize: 17 },
          headerShadowVisible: false,
          headerBackTitle: "Stores",
          headerLargeTitle: false,
        })}
      />
    </Stack.Navigator>
  );
}

// Custom tab bar badge
function TabBadge({ count }) {
  if (!count) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
    </View>
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
          if (route.name === "HomeTab") {
            iconName = focused ? "house.fill" : "house";
          } else if (route.name === "BrowseTab") {
            iconName = focused ? "search" : "search-outline";
          } else if (route.name === "MembershipTab") {
            iconName = focused ? "sparkles" : "sparkles-outline";
          } else if (route.name === "ProfileTab") {
            iconName = focused ? "person.fill" : "person";
          }
          // Use Ionicons equivalents
          const iosNames = {
            "house.fill": "home",
            "house": "home-outline",
            "person.fill": "person",
            "person": "person-outline",
          };
          return <Ionicons name={iosNames[iconName] || iconName} size={size} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: "rgba(242, 242, 247, 0.95)",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: "rgba(60, 60, 67, 0.29)",
          height: 83,
          paddingBottom: 28,
          paddingTop: 10,
        },
        tabBarActiveTintColor: "#012a62",
        tabBarInactiveTintColor: "rgba(60, 60, 67, 0.45)",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
          letterSpacing: -0.1,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={DirectoryStack}
        options={{ tabBarLabel: "Home" }}
      />
      <Tab.Screen
        name="BrowseTab"
        component={SearchScreen}
        options={{ tabBarLabel: "Browse" }}
      />
      <Tab.Screen
        name="MembershipTab"
        component={VodaGoldScreen}
        options={{ tabBarLabel: "Membership" }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: "#ff3b30",
            color: "#ffffff",
            fontSize: 11,
            fontWeight: "600",
            minWidth: 18,
            height: 18,
            lineHeight: 17,
          },
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: "#ff3b30",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#f2f2f7",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
  },
});
