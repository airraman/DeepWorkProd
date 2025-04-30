// App.js
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ThemeProvider } from './src/context/ThemeContext';
import * as Notifications from 'expo-notifications';
import { navigationRef } from './src/services/navigationService'; // You'll need to create this

// Import screens
import InitialSetupScreen from './src/screens/InitialSetUpScreen';
import HomeScreen from './src/screens/HomeScreen';
import MetricsScreen from './src/screens/MetricsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import DeepWorkSession from './src/screens/DeepWorkSession';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Metrics" component={MetricsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}



// Main App component using both navigators
function App() {

  useEffect(() => {
    // Set up response handler
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const actionId = response.actionIdentifier;
      
      if (actionId === 'PAUSE_RESUME') {
        // Get the active session and toggle pause state
        const handlePauseResume = async () => {
          const sessionData = await getActiveSessionFromStorage();
          if (sessionData) {
            await backgroundTimer.updateTimerPauseState(!sessionData.isPaused);
          }
        };
        handlePauseResume();
      } 
      else if (actionId === 'END_SESSION') {
        // End the session
        backgroundTimer.stopTimerNotification();
        if (navigationRef.current) {
          navigationRef.current.navigate('MainApp', { screen: 'Home' });
        }
      }
      else if (response.notification.request.content.data.screen) {
        // Navigate to the session screen if notification was tapped
        const screen = response.notification.request.content.data.screen;
        if (navigationRef.current) {
          navigationRef.current.navigate(screen);
        }
      }
    });
    
    return () => subscription.remove();
  }, []);
  
  return (
    <ThemeProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName="InitialSetup"
          screenOptions={{
            headerShown: false,
            gestureEnabled: false
          }}
        >
          <Stack.Screen name="InitialSetup" component={InitialSetupScreen} />
          <Stack.Screen name="MainApp" component={TabNavigator} />
          <Stack.Screen 
            name="DeepWorkSession" 
            component={DeepWorkSession}
            options={{
              gestureEnabled: false,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}

export default App;