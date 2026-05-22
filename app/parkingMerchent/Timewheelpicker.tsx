/**
 * TimeWheelPicker.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * A native-feel modal time picker with scrollable hour & minute wheels.
 * Minutes are in 15-min increments: 00, 15, 30, 45.
 *
 * Usage:
 *   <TimeWheelPicker
 *     visible={pickerVisible}
 *     value="09:30"
 *     onConfirm={(time) => handleTime(time)}   // "HH:MM"
 *     onCancel={() => setPickerVisible(false)}
 *     title="Select Start Time"
 *   />
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from 'react-native-responsive-dimensions';

// ── Constants ────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 5; // odd number — selected is the middle one
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const MINUTES = [0, 15, 30, 45];
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0–23

const pad = (n: number) => String(n).padStart(2, '0');

// ── WheelColumn ──────────────────────────────────────────────────────────────

interface WheelColumnProps {
  data: number[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  formatter?: (n: number) => string;
  label?: string;
}

const WheelColumn: React.FC<WheelColumnProps> = ({
  data,
  selectedIndex,
  onSelect,
  formatter = (n) => pad(n),
  label,
}) => {
  const flatRef = useRef<FlatList>(null);
  const [localIndex, setLocalIndex] = useState(selectedIndex);

  // Pad top and bottom so first/last items can centre
  const paddedData = [
    ...Array(Math.floor(VISIBLE_ITEMS / 2)).fill(null),
    ...data,
    ...Array(Math.floor(VISIBLE_ITEMS / 2)).fill(null),
  ];

  useEffect(() => {
    if (selectedIndex !== localIndex) {
      setLocalIndex(selectedIndex);
      flatRef.current?.scrollToIndex({
        index: selectedIndex + Math.floor(VISIBLE_ITEMS / 2),
        animated: true,
        viewOffset: 0,
        viewPosition: 0,
      });
    }
  }, [selectedIndex]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const mid = Math.floor(VISIBLE_ITEMS / 2);
      const midItem = viewableItems.find(
        (v) => v.index !== null && v.index === Math.floor(viewableItems.length / 2) + mid
      );
      if (!midItem) return;
      const realIndex = (midItem.index ?? 0) - Math.floor(VISIBLE_ITEMS / 2);
      if (realIndex >= 0 && realIndex < data.length) {
        setLocalIndex(realIndex);
      }
    },
    [data.length]
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 });

  const handleMomentumEnd = (e: any) => {
    const offset = e.nativeEvent.contentOffset.y;
    const index = Math.round(offset / ITEM_HEIGHT);
    const realIndex = Math.max(0, Math.min(index, data.length - 1));
    setLocalIndex(realIndex);
    onSelect(realIndex);
  };

  const renderItem = ({ item, index }: { item: number | null; index: number }) => {
    const realIndex = index - Math.floor(VISIBLE_ITEMS / 2);
    const isSelected = realIndex === localIndex;
    const isNull = item === null;

    return (
      <TouchableOpacity
        activeOpacity={isNull ? 1 : 0.7}
        style={styles.wheelItem}
        onPress={() => {
          if (!isNull && realIndex >= 0 && realIndex < data.length) {
            setLocalIndex(realIndex);
            onSelect(realIndex);
            flatRef.current?.scrollToIndex({
              index,
              animated: true,
              viewPosition: 0.5,
            });
          }
        }}
      >
        <Text
          style={[
            styles.wheelItemText,
            isSelected && styles.wheelItemTextSelected,
            isNull && styles.wheelItemTextNull,
          ]}
        >
          {isNull ? '' : formatter(item as number)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wheelColumn}>
      {label && <Text style={styles.wheelColumnLabel}>{label}</Text>}
      <View style={styles.wheelContainer}>
        {/* Selection highlight */}
        <View style={styles.selectionHighlight} pointerEvents="none" />
        <FlatList
          ref={flatRef}
          data={paddedData}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={handleMomentumEnd}
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          initialScrollIndex={selectedIndex + Math.floor(VISIBLE_ITEMS / 2)}
          onScrollToIndexFailed={() => {}}
          viewabilityConfig={viewabilityConfig.current}
          onViewableItemsChanged={onViewableItemsChanged}
          scrollEventThrottle={16}
        />
      </View>
    </View>
  );
};

// ── TimeWheelPicker ───────────────────────────────────────────────────────────

interface TimeWheelPickerProps {
  visible: boolean;
  value?: string;        // "HH:MM"
  onConfirm: (time: string) => void;
  onCancel: () => void;
  title?: string;
  accentColor?: string;
}

const TimeWheelPicker: React.FC<TimeWheelPickerProps> = ({
  visible,
  value = '00:00',
  onConfirm,
  onCancel,
  title = 'Select Time',
  accentColor = '#FF6B35',
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  // Parse incoming value
  const parseValue = (v: string) => {
    const [hStr, mStr] = v.split(':');
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const minIndex = MINUTES.indexOf(m === 60 ? 0 : m);
    return {
      hourIndex: Math.max(0, Math.min(h, 23)),
      minuteIndex: minIndex >= 0 ? minIndex : 0,
    };
  };

  const { hourIndex: initH, minuteIndex: initM } = parseValue(value);
  const [hourIndex, setHourIndex] = useState(initH);
  const [minuteIndex, setMinuteIndex] = useState(initM);

  // Sync when value prop changes
  useEffect(() => {
    const { hourIndex: h, minuteIndex: m } = parseValue(value);
    setHourIndex(h);
    setMinuteIndex(m);
  }, [value, visible]);

  // Animate in / out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleConfirm = () => {
    const time = `${pad(HOURS[hourIndex])}:${pad(MINUTES[minuteIndex])}`;
    onConfirm(time);
  };

  const currentTime = `${pad(HOURS[hourIndex])}:${pad(MINUTES[minuteIndex])}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onCancel} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Handle bar */}
        <View style={styles.handleBar} />

        {/* Title row */}
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={onCancel} style={styles.headerBtn}>
            <Text style={[styles.headerBtnText, { color: '#888' }]}>Cancel</Text>
          </TouchableOpacity>
          <View style={styles.titleCenter}>
            <Text style={styles.titleText}>{title}</Text>
            <Text style={[styles.previewTime, { color: accentColor }]}>
              {currentTime}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleConfirm}
            style={[styles.headerBtn, styles.confirmBtn, { backgroundColor: accentColor }]}
          >
            <Text style={styles.confirmBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Wheels */}
        <View style={styles.wheelsRow}>
          <WheelColumn
            data={HOURS}
            selectedIndex={hourIndex}
            onSelect={setHourIndex}
            formatter={(n) => pad(n)}
            label="Hour"
          />

          {/* Colon separator */}
          <View style={styles.colonContainer}>
            <Text style={[styles.colonText, { color: accentColor }]}>:</Text>
          </View>

          <WheelColumn
            data={MINUTES}
            selectedIndex={minuteIndex}
            onSelect={setMinuteIndex}
            formatter={(n) => pad(n)}
            label="Min"
          />
        </View>

        {/* AM/PM hint (24h indicator) */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>24-hour format  •  15-minute steps</Text>
        </View>
      </Animated.View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: responsiveHeight(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveWidth(5),
    paddingVertical: responsiveHeight(1.5),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  titleCenter: {
    alignItems: 'center',
    flex: 1,
  },
  titleText: {
    fontSize: responsiveFontSize(1.9),
    fontWeight: '700',
    color: '#1A1A1A',
  },
  previewTime: {
    fontSize: responsiveFontSize(2.4),
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 2,
  },
  headerBtn: {
    paddingHorizontal: responsiveWidth(2),
    paddingVertical: responsiveHeight(0.6),
    borderRadius: 8,
    minWidth: responsiveWidth(16),
    alignItems: 'center',
  },
  headerBtnText: {
    fontSize: responsiveFontSize(1.8),
    fontWeight: '600',
  },
  confirmBtn: {
    borderRadius: 10,
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: responsiveFontSize(1.8),
    fontWeight: '700',
  },

  // Wheels layout
  wheelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveWidth(8),
    marginTop: responsiveHeight(1),
  },
  wheelColumn: {
    alignItems: 'center',
    flex: 1,
  },
  wheelColumnLabel: {
    fontSize: responsiveFontSize(1.4),
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  wheelContainer: {
    height: PICKER_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  selectionHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
    left: 8,
    right: 8,
    height: ITEM_HEIGHT,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    zIndex: 0,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemText: {
    fontSize: responsiveFontSize(2.2),
    fontWeight: '500',
    color: '#BBBBC0',
  },
  wheelItemTextSelected: {
    fontSize: responsiveFontSize(3),
    fontWeight: '800',
    color: '#1A1A1A',
  },
  wheelItemTextNull: {
    color: 'transparent',
  },

  colonContainer: {
    paddingTop: responsiveHeight(2),
    paddingHorizontal: responsiveWidth(2),
    alignItems: 'center',
  },
  colonText: {
    fontSize: responsiveFontSize(4),
    fontWeight: '900',
  },

  footer: {
    alignItems: 'center',
    marginTop: responsiveHeight(1),
    paddingHorizontal: responsiveWidth(5),
  },
  footerText: {
    fontSize: responsiveFontSize(1.4),
    color: '#BBB',
    letterSpacing: 0.3,
  },
});

export default TimeWheelPicker;