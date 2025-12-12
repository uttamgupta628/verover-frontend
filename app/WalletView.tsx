import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import colors from '../assets/color';

interface TransactionRowProps {
  type: 'Withdrew' | 'Deposited';
  amount: number;
  date: string;
  status: 'Done' | 'Pending' | 'Failed';
  description?: string;
}

const TransactionRow: React.FC<TransactionRowProps> = ({
  type,
  amount,
  date,
  status,
  description,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'Done': return '#4CD964';
      case 'Pending': return '#FF9500';
      case 'Failed': return '#FF3B30';
      default: return colors.gray;
    }
  };

  const getIconName = () => {
    return type === 'Withdrew' ? 'arrow-up-right' : 'arrow-down-left';
  };

  const getIconColor = () => {
    return type === 'Withdrew' ? '#FF3B30' : '#4CD964';
  };

  return (
    <TouchableOpacity style={styles.container}>
      <View style={styles.iconContainer}>
        <View style={[styles.iconBackground, { backgroundColor: getIconColor() + '20' }]}>
          <Feather 
            name={getIconName()} 
            size={20} 
            color={getIconColor()} 
          />
        </View>
      </View>
      
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.description} numberOfLines={1}>
            {description || type}
          </Text>
          <Text style={[
            styles.amount,
            { color: type === 'Withdrew' ? '#FF3B30' : '#4CD964' }
          ]}>
            {type === 'Withdrew' ? '-' : '+'}${Math.abs(amount).toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.bottomRow}>
          <Text style={styles.date}>{date}</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={[styles.status, { color: getStatusColor() }]}>
              {status}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
  },
  iconBackground: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  description: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    flex: 1,
    marginRight: 8,
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
    color: colors.gray,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default TransactionRow;