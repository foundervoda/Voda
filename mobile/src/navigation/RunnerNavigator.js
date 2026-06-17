import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "../store/useAuthStore";
import RunnerDashboard from "../screens/runner/RunnerDashboard";
import AcceptOrderScreen from "../screens/runner/AcceptOrderScreen";
import CollectionScreen from "../screens/runner/CollectionScreen";
import HandoverScreen from "../screens/runner/HandoverScreen";
import RiderDashboard from "../screens/runner/RiderDashboard";
import RiderDeliveryScreen from "../screens/runner/RiderDeliveryScreen";

const Stack = createNativeStackNavigator();

export default function RunnerNavigator() {
  const { user } = useAuthStore();
  const isRider = user?.role === "RIDER";

  return isRider ? (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RiderDashboard" component={RiderDashboard} />
      <Stack.Screen name="RiderDelivery" component={RiderDeliveryScreen} />
    </Stack.Navigator>
  ) : (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RunnerDashboard" component={RunnerDashboard} />
      <Stack.Screen name="AcceptOrder" component={AcceptOrderScreen} />
      <Stack.Screen name="Collection" component={CollectionScreen} />
      <Stack.Screen name="Handover" component={HandoverScreen} />
    </Stack.Navigator>
  );
}
