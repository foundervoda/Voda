import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "../store/useAuthStore";
import RunnerDashboard from "../screens/runner/RunnerDashboard";
import AcceptOrderScreen from "../screens/runner/AcceptOrderScreen";
import CollectionScreen from "../screens/runner/CollectionScreen";
import HandoverScreen from "../screens/runner/HandoverScreen";
import RunnerReturnScreen from "../screens/runner/RunnerReturnScreen";
import RiderDashboard from "../screens/rider/RiderDashboard";
import RiderDeliveryScreen from "../screens/rider/RiderDeliveryScreen";
import RiderHistoryScreen from "../screens/rider/RiderHistoryScreen";
import RunnerHistoryScreen from "../screens/runner/RunnerHistoryScreen";

const Stack = createNativeStackNavigator();

export default function RunnerNavigator() {
  const { user } = useAuthStore();
  const isRider = user?.role === "RIDER";

  return isRider ? (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RiderDashboard" component={RiderDashboard} />
      <Stack.Screen name="RiderDelivery" component={RiderDeliveryScreen} />
      <Stack.Screen name="RiderHistory" component={RiderHistoryScreen} />
    </Stack.Navigator>
  ) : (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RunnerDashboard" component={RunnerDashboard} />
      <Stack.Screen name="AcceptOrder" component={AcceptOrderScreen} />
      <Stack.Screen name="Collection" component={CollectionScreen} />
      <Stack.Screen name="Handover" component={HandoverScreen} />
      <Stack.Screen name="RunnerReturn" component={RunnerReturnScreen} />
      <Stack.Screen name="RunnerHistory" component={RunnerHistoryScreen} />
    </Stack.Navigator>
  );
}
