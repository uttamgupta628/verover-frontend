import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <>
      {/* Header is now in the parent layout, so we don't need it here */}
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#FF8C00',
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="home" color={color} size={size} />
            ),
          }}
        />
        {/* Add more tabs as needed */}
        <Tabs.Screen
          name="parking"
          options={{
            title: 'Parking',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="parking" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="history" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="account" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}