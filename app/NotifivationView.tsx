import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { IconButton } from 'react-native-paper';
import colors from '../assets/color';
import { ParkingViewType } from './types';
import { responsiveHeight, responsiveWidth } from 'react-native-responsive-dimensions';

// EXPO-SPECIFIC IMPORTS
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface NotificationViewProps {
  onBack: () => void;
  onNavigate: (screen: ParkingViewType) => void;
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  screen: ParkingViewType;
  timeAgo: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
}

const NotificationView: React.FC<NotificationViewProps> = ({
  onBack,
  onNavigate,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      title: 'Parking Session Started',
      description: 'Your parking session at Downtown Mall has started.',
      screen: 'LiveSessionScreen',
      timeAgo: '2 minutes ago',
      read: false,
      type: 'success'
    },
    {
      id: '2',
      title: 'Payment Successful',
      description: 'Your payment of $15.00 for parking was processed.',
      screen: 'HistoryScreen',
      timeAgo: '1 hour ago',
      read: false,
      type: 'success'
    },
    {
      id: '3',
      title: 'Parking Reminder',
      description: 'Your parking session will end in 30 minutes.',
      screen: 'LiveSessionScreen',
      timeAgo: '3 hours ago',
      read: true,
      type: 'warning'
    },
    {
      id: '4',
      title: 'New Feature Available',
      description: 'Try our new parking spot reservation feature!',
      screen: 'FindParking',
      timeAgo: '1 day ago',
      read: true,
      type: 'info'
    },
    {
      id: '5',
      title: 'Payment Failed',
      description: 'Your recent payment failed. Please update your payment method.',
      screen: 'FareCard',
      timeAgo: '2 days ago',
      read: true,
      type: 'error'
    },
  ]);

  const messages = [
    'Stay updated with your parking sessions and payments.',
    'Get instant notifications about your parking activities.',
    'Never miss important updates about your parking spots.',
    'Real-time alerts for session start and end times.',
    'Receive payment confirmations and reminders instantly.',
    'Get notified about available parking spots nearby.',
    'Important announcements and feature updates.',
  ];

  const [currentMessage, setCurrentMessage] = useState(messages[0]);
  const [messageIndex, setMessageIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();

  // Animation for message transition
  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setMessageIndex((prevIndex) => (prevIndex + 1) % messages.length);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    }, 4000); // Change message every 4 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCurrentMessage(messages[messageIndex]);
  }, [messageIndex]);

  const handleBackWithHaptic = async () => {
    await Haptics.selectionAsync();
    onBack();
  };

  const handleNotificationPress = async (notification: NotificationItem) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Mark as read if unread
    if (!notification.read) {
      setNotifications(prev =>
        prev.map(item =>
          item.id === notification.id ? { ...item, read: true } : item
        )
      );
    }
    
    onNavigate(notification.screen);
  };

  const markAllAsRead = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNotifications(prev =>
      prev.map(item => ({ ...item, read: true }))
    );
  };

  const clearAllNotifications = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setNotifications([]);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return { icon: 'check-circle', color: '#4CD964' };
      case 'warning': return { icon: 'alert-circle', color: '#FF9500' };
      case 'error': return { icon: 'x-circle', color: '#FF3B30' };
      default: return { icon: 'info', color: colors.primary };
    }
  };

  const getUnreadCount = () => {
    return notifications.filter(n => !n.read).length;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <BlurView intensity={80} tint="light" style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={handleBackWithHaptic} 
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color={colors.primary} />
          </TouchableOpacity>
          
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {getUnreadCount() > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{getUnreadCount()}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.headerActions}>
            {notifications.length > 0 && getUnreadCount() > 0 && (
              <TouchableOpacity 
                onPress={markAllAsRead} 
                style={styles.actionButton}
              >
                <Feather name="check-all" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
            {notifications.length > 0 && (
              <TouchableOpacity 
                onPress={clearAllNotifications} 
                style={styles.actionButton}
              >
                <Feather name="trash-2" size={20} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </BlurView>

      {/* Dynamic Message Banner */}
      <Animated.View style={[styles.messageContainer, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={[colors.primary, '#4A90E2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.messageBanner}
        >
          <Feather name="bell" size={20} color="#FFFFFF" style={styles.bellIcon} />
          <Text style={styles.dynamicMessage}>{currentMessage}</Text>
        </LinearGradient>
      </Animated.View>

      {/* Notifications List */}
      <ScrollView 
        style={styles.notificationsContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.notificationsList,
          notifications.length === 0 && styles.emptyList
        ]}
      >
        {notifications.length > 0 ? (
          notifications.map((notification) => {
            const { icon, color } = getNotificationIcon(notification.type);
            
            return (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationItem,
                  notification.read && styles.readNotification,
                  { borderLeftColor: color }
                ]}
                onPress={() => handleNotificationPress(notification)}
                activeOpacity={0.7}
              >
                <View style={styles.notificationIcon}>
                  <Feather name={icon as any} size={22} color={color} />
                  {!notification.read && (
                    <View style={styles.unreadDot} />
                  )}
                </View>
                
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={[
                      styles.notificationTitle,
                      !notification.read && styles.unreadTitle
                    ]}>
                      {notification.title}
                    </Text>
                    <Text style={styles.timeAgo}>{notification.timeAgo}</Text>
                  </View>
                  
                  <Text style={styles.notificationDescription} numberOfLines={2}>
                    {notification.description}
                  </Text>
                </View>
                
                <Feather name="chevron-right" size={18} color={colors.lightGray} />
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Feather name="bell-off" size={60} color={colors.lightGray} />
            <Text style={styles.emptyStateTitle}>No Notifications</Text>
            <Text style={styles.emptyStateText}>
              You're all caught up! Check back later for updates.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: responsiveHeight(8),
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.black,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  messageContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bellIcon: {
    marginRight: 12,
  },
  dynamicMessage: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  notificationsContainer: {
    flex: 1,
  },
  notificationsList: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  readNotification: {
    opacity: 0.7,
  },
  notificationIcon: {
    marginRight: 16,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.black,
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  timeAgo: {
    fontSize: 12,
    color: colors.gray,
  },
  notificationDescription: {
    fontSize: 14,
    color: colors.darkGray,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.black,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.gray,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
});

export default NotificationView;