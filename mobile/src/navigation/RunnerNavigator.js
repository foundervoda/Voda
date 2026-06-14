import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RunnerDashboard from "../screens/runner/RunnerDashboard";
import AcceptOrderScreen from "../screens/runner/AcceptOrderScreen";
import CollectionScreen from "../screens/runner/CollectionScreen";
import HandoverScreen from "../screens/runner/HandoverScreen";

const Stack = createNativeStackNavigator();

export default function RunnerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RunnerDashboard" component={RunnerDashboard} />
      <Stack.Screen name="AcceptOrder" component={AcceptOrderScreen} />
      <Stack.Screen name="Collection" component={CollectionScreen} />
      <Stack.Screen name="Handover" component={HandoverScreen} />
    </Stack.Navigator>
  );
}
