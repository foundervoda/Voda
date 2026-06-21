import { enableScreens } from 'react-native-screens';
import { registerRootComponent } from 'expo';

import App from './App';

// Initialize native screens before any navigation component mounts.
// Prevents the Fabric "linkRootNode of null" crash during fast refresh.
enableScreens();

registerRootComponent(App);
