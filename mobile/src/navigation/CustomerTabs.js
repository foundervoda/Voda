import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/customer/HomeScreen";
import ProfileScreen from "../screens/customer/ProfileScreen";
import { Ionicons } from "@expo/vector-icons";

const Tab = createBottomTabNavigator();

export default function CustomerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => {
          let iconName;
          if (route.name === "HomeTab") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "ProfileTab") {
            iconName = focused ? "person" : "person-outline";
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: "#fdf9ea",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#012a62",
        tabBarInactiveTintColor: "#012a6250",
        headerStyle: { backgroundColor: "#fdf9ea" },
        headerTintColor: "#012a62",
        headerTitleStyle: { fontWeight: "700" },
      })}
    >
      <Tab.Screen name="HomeTab"    component={HomeScreen}    options={{ title: "Home", headerShown: false }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: "Profile", headerShown: false }} />
    </Tab.Navigator>
  );
}

