import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/customer/HomeScreen";
import SearchScreen from "../screens/customer/SearchScreen";
import CartScreen from "../screens/customer/CartScreen";

const Tab = createBottomTabNavigator();

// Tab shell for the Customer flow (Handbook §05 / Sprint 1 task 6)
export default function CustomerTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
    </Tab.Navigator>
  );
}
