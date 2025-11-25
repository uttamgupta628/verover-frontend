import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { COLORS } from '../../constants/colors';
import { useAppSelector, useAppDispatch } from '../../components/redux/hooks';
import { logoutUser } from '../../components/redux/authSlice';

export default function HomeScreen() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logoutUser());
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Verover!</Text>
      <Text style={styles.subtitle}>Your rides, parking & dry cleaning app</Text>
      
      {user && (
        <>
          <View style={styles.userInfo}>
            <Text style={styles.userText}>👋 Hi, {user.firstName}!</Text>
            <Text style={styles.userText}>📧 {user.email}</Text>
            <Text style={styles.userText}>👤 {user.userType}</Text>
          </View>
          
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 30,
  },
  userInfo: {
    backgroundColor: 'rgba(255, 140, 0, 0.1)',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    width: '100%',
  },
  userText: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 8,
  },
  logoutButton: {
    backgroundColor: '#FF8C00',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
