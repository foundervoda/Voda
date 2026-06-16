import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RiderDashboard from "../screens/rider/RiderDashboard";
import RiderDeliveryScreen from "../screens/rider/RiderDeliveryScreen";
import RiderArrivedScreen from "../screens/rider/RiderArrivedScreen";
import RiderTnbTimerScreen from "../screens/rider/RiderTnbTimerScreen";
import RiderReturnScreen from "../screens/rider/RiderReturnScreen";

const Stack = createNativeStackNavigator();

export default function RiderNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RiderDashboard" component={RiderDashboard} />
      <Stack.Screen name="RiderDelivery" component={RiderDeliveryScreen} />
      <Stack.Screen name="RiderArrived" component={RiderArrivedScreen} />
      <Stack.Screen name="RiderTnbTimer" component={RiderTnbTimerScreen} />
      <Stack.Screen name="RiderReturn" component={RiderReturnScreen} />
    </Stack.Navigator>
  );
}
