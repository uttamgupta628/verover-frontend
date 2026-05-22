import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, StatusBar, Animated, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, RefreshCw, Repeat, LayoutDashboard,
  Grid, List, Car, Home, Warehouse, CalendarDays,
  Shirt,
} from 'lucide-react-native';
import { responsiveHeight, responsiveWidth, responsiveFontSize } from 'react-native-responsive-dimensions';
import axiosInstance from '../../api/axios';
import colors from '../../assets/color';
import DryCleaningTab from './Drycleaningtab';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type PeriodKey = 'daily' | 'weekly' | 'monthly';
type VenueType = 'parking' | 'garage' | 'residence';

interface EarningPeriod { daily: number; weekly: number; monthly: number; }
interface SlotStats { total: number; booked: number; available: number; }

interface VenueSummary {
  id: string; name: string; type: VenueType; address: string;
  earnings: EarningPeriod; slots: SlotStats;
  monthlyChargeEnabled: boolean; monthlyRate: number;
  activeMonthlySubscriptions: number; recentBookings: BookingSummary[];
}

interface BookingSummary {
  _id: string; customerName: string; slot: string;
  from: string; to: string; amount: number;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  paymentMethod: string; type: VenueType; isMonthly?: boolean;
}

interface DashboardData {
  totalEarnings: EarningPeriod; totalBookings: EarningPeriod;
  venues: VenueSummary[]; recentBookings: BookingSummary[];
}

// ─────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────
const C = {
  bg:          '#FAFAFA',
  card:        '#FFFFFF',
  brand:       colors.brandColor,
  brandLight:  '#FFF3E5',
  text:        colors.text,
  gray:        colors.gray,
  lightGray:   colors.lightGray,
  border:      '#EBEBEB',
  success:     '#22C55E',
  successBg:   '#F0FDF4',
  warning:     '#F59E0B',
  warningBg:   '#FFFBEB',
  error:       colors.error,
  errorBg:     '#FFF1F1',
  parking:     '#3B82F6',
  parkingBg:   '#EFF6FF',
  garage:      '#8B5CF6',
  garageBg:    '#F5F3FF',
  residence:   '#10B981',
  residenceBg: '#ECFDF5',
};

const VENUE_COLOR: Record<VenueType, string> = {
  parking: C.parking, garage: C.garage, residence: C.residence,
};
const VENUE_BG: Record<VenueType, string> = {
  parking: C.parkingBg, garage: C.garageBg, residence: C.residenceBg,
};
const PERIOD_LABEL: Record<PeriodKey, string> = {
  daily: 'Today', weekly: 'This Week', monthly: 'This Month',
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const fmtCurrency = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const statusColor = (s: string) =>
  s === 'SUCCESS' ? C.success : s === 'PENDING' ? C.warning : C.error;
const statusBg = (s: string) =>
  s === 'SUCCESS' ? C.successBg : s === 'PENDING' ? C.warningBg : C.errorBg;

const VenueIcon = ({ type, size = 18, color }: { type: VenueType; size?: number; color: string }) => {
  if (type === 'parking') return <Car       size={size} color={color} />;
  if (type === 'garage')  return <Warehouse size={size} color={color} />;
  return                         <Home      size={size} color={color} />;
};

// ─────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────
const PeriodToggle = ({ period, onChange }: { period: PeriodKey; onChange: (p: PeriodKey) => void }) => (
  <View style={s.periodRow}>
    {(['daily', 'weekly', 'monthly'] as PeriodKey[]).map(p => (
      <TouchableOpacity
        key={p}
        style={[s.periodBtn, period === p && s.periodBtnActive]}
        onPress={() => onChange(p)}
        activeOpacity={0.75}
      >
        <Text style={[s.periodBtnText, period === p && s.periodBtnTextActive]}>
          {p.charAt(0).toUpperCase() + p.slice(1)}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

const SectionTitle = ({ title }: { title: string }) => (
  <Text style={s.sectionTitle}>{title}</Text>
);

const VenueCard = ({ venue, period }: { venue: VenueSummary; period: PeriodKey }) => {
  const vc  = VENUE_COLOR[venue.type];
  const vbg = VENUE_BG[venue.type];
  const pct = venue.slots.total > 0
    ? Math.round((venue.slots.booked / venue.slots.total) * 100) : 0;

  return (
    <View style={s.venueCard}>
      <View style={s.venueHeader}>
        <View style={[s.iconWrap, { backgroundColor: vbg }]}>
          <VenueIcon type={venue.type} size={20} color={vc} />
        </View>
        <View style={{ flex: 1, marginLeft: responsiveWidth(3) }}>
          <Text style={s.venueName} numberOfLines={1}>{venue.name}</Text>
          <Text style={s.venueAddr} numberOfLines={1}>{venue.address}</Text>
        </View>
        <View style={[s.earningPill, { backgroundColor: vbg }]}>
          <Text style={[s.earningPillText, { color: vc }]}>
            {fmtCurrency(venue.earnings[period])}
          </Text>
        </View>
      </View>
      <View style={s.occRow}>
        <Text style={s.occLabel}>Occupancy</Text>
        <Text style={[s.occPct, { color: vc }]}>{pct}%</Text>
      </View>
      <View style={s.barBg}>
        <View style={[s.barFill, { width: `${pct}%` as any, backgroundColor: vc }]} />
      </View>
      <View style={s.slotRow}>
        {[
          { label: 'Booked', value: venue.slots.booked,    color: vc        },
          { label: 'Free',   value: venue.slots.available, color: C.success },
          { label: 'Total',  value: venue.slots.total,     color: C.gray    },
        ].map(item => (
          <View key={item.label} style={s.slotItem}>
            <Text style={[s.slotNum, { color: item.color }]}>{item.value}</Text>
            <Text style={s.slotItemLabel}>{item.label}</Text>
          </View>
        ))}
        {venue.monthlyChargeEnabled && (
          <View style={s.monthlyTag}>
            <Repeat size={10} color={C.brand} />
            <Text style={s.monthlyTagText}>{venue.activeMonthlySubscriptions} monthly</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const BookingRow = ({ booking }: { booking: BookingSummary }) => {
  const vc  = VENUE_COLOR[booking.type];
  const vbg = VENUE_BG[booking.type];
  const now = Date.now();
  const isActive =
    new Date(booking.from).getTime() <= now &&
    new Date(booking.to).getTime()   >= now;

  return (
    <View style={s.bookingRow}>
      <View style={[s.bookingIcon, { backgroundColor: vbg }]}>
        <VenueIcon type={booking.type} size={16} color={vc} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.bookingTopLine}>
          <Text style={s.bookingName} numberOfLines={1}>{booking.customerName}</Text>
          {booking.isMonthly && (
            <View style={s.monthlyBadge}>
              <Repeat size={9} color={C.brand} />
              <Text style={s.monthlyBadgeText}>Monthly</Text>
            </View>
          )}
          {isActive && <View style={s.activeDot} />}
        </View>
        <Text style={s.bookingSlot}>
          Slot {booking.slot} · {fmtDate(booking.from)} {fmtTime(booking.from)}
        </Text>
      </View>
      <View style={s.bookingRight}>
        <Text style={s.bookingAmt}>${booking.amount.toFixed(2)}</Text>
        <View style={[s.statusPill, { backgroundColor: statusBg(booking.status) }]}>
          <Text style={[s.statusPillText, { color: statusColor(booking.status) }]}>
            {booking.status}
          </Text>
        </View>
      </View>
    </View>
  );
};

// Monthly venue card — read-only, no edit button
const MonthlyVenueCard = ({ venue }: { venue: VenueSummary }) => {
  const vc  = VENUE_COLOR[venue.type];
  const vbg = VENUE_BG[venue.type];

  return (
    <View style={s.mCard}>
      <View style={s.mCardHeader}>
        <View style={[s.iconWrap, { backgroundColor: vbg }]}>
          <VenueIcon type={venue.type} size={18} color={vc} />
        </View>
        <View style={{ flex: 1, marginLeft: responsiveWidth(3) }}>
          <Text style={s.venueName} numberOfLines={1}>{venue.name}</Text>
          <Text style={s.venueType}>
            {venue.type.charAt(0).toUpperCase() + venue.type.slice(1)}
          </Text>
        </View>
        <View style={[
          s.enabledPill,
          { backgroundColor: venue.monthlyChargeEnabled ? C.successBg : C.lightGray },
        ]}>
          <Text style={[
            s.enabledPillText,
            { color: venue.monthlyChargeEnabled ? C.success : C.gray },
          ]}>
            {venue.monthlyChargeEnabled ? 'Enabled' : 'Disabled'}
          </Text>
        </View>
      </View>

      {venue.monthlyChargeEnabled && (
        <View style={s.mCardBody}>
          <View style={s.mRateRow}>
            <Text style={s.mRateLabel}>Monthly Rate</Text>
            <Text style={[s.mRateValue, { color: C.brand }]}>
              ${venue.monthlyRate}<Text style={s.mRateSuffix}>/mo</Text>
            </Text>
          </View>
          <View style={s.mStatsRow}>
            {[
              { label: 'Active Subs', value: `${venue.activeMonthlySubscriptions}`, hi: false },
              { label: 'MRR',        value: `$${venue.monthlyRate * venue.activeMonthlySubscriptions}`, hi: true },
              { label: 'Slots Used', value: `${venue.slots.booked}/${venue.slots.total}`, hi: false },
            ].map((item, i) => (
              <React.Fragment key={item.label}>
                {i > 0 && <View style={s.mStatsDivider} />}
                <View style={s.mStatItem}>
                  <Text style={[s.mStatNum, item.hi && { color: C.brand }]}>{item.value}</Text>
                  <Text style={s.mStatLabel}>{item.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Tab screens
// ─────────────────────────────────────────────────────────────
const OverviewTab = ({
  data, period, onPeriodChange,
}: { data: DashboardData; period: PeriodKey; onPeriodChange: (p: PeriodKey) => void }) => (
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabContent}>
    <PeriodToggle period={period} onChange={onPeriodChange} />

    <View style={s.heroRow}>
      <View style={[s.statCard, { borderLeftColor: C.brand }]}>
        <Text style={s.statLabel}>Total Revenue</Text>
        <Text style={[s.statValue, { color: C.brand }]}>{fmtCurrency(data.totalEarnings[period])}</Text>
        <Text style={s.statSub}>{PERIOD_LABEL[period]}</Text>
      </View>
      <View style={[s.statCard, { borderLeftColor: C.parking }]}>
        <Text style={s.statLabel}>Total Bookings</Text>
        <Text style={[s.statValue, { color: C.parking }]}>{data.totalBookings[period]}</Text>
        <Text style={s.statSub}>{PERIOD_LABEL[period]}</Text>
      </View>
    </View>

    <View style={s.typeStrip}>
      {(['parking', 'garage', 'residence'] as VenueType[]).map(type => {
        const total = data.venues.filter(v => v.type === type)
          .reduce((sum, v) => sum + v.earnings[period], 0);
        const vc  = VENUE_COLOR[type];
        const vbg = VENUE_BG[type];
        return (
          <View key={type} style={s.typeItem}>
            <View style={[s.typeIconWrap, { backgroundColor: vbg }]}>
              <VenueIcon type={type} size={16} color={vc} />
            </View>
            <Text style={[s.typeValue, { color: vc }]}>{fmtCurrency(total)}</Text>
            <Text style={s.typeLabel}>
              {type.charAt(0).toUpperCase() + type.slice(1)}s
            </Text>
          </View>
        );
      })}
    </View>

    <SectionTitle title="Your Venues" />
    {data.venues.map(v => <VenueCard key={v.id} venue={v} period={period} />)}

    <View style={s.mrrBanner}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <View style={[s.iconWrap, { backgroundColor: C.brandLight }]}>
          <Repeat size={18} color={C.brand} />
        </View>
        <View style={{ marginLeft: responsiveWidth(3) }}>
          <Text style={s.mrrBannerTitle}>Monthly Recurring Revenue</Text>
          <Text style={s.mrrBannerSub}>All venues with monthly plans</Text>
        </View>
      </View>
      <Text style={[s.mrrBannerValue, { color: C.brand }]}>
        ${data.venues
          .filter(v => v.monthlyChargeEnabled)
          .reduce((sum, v) => sum + v.monthlyRate * v.activeMonthlySubscriptions, 0)
          .toLocaleString()}
      </Text>
    </View>
  </ScrollView>
);

const SlotsTab = ({ data }: { data: DashboardData }) => (
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabContent}>
    <SectionTitle title="Slot Availability" />
    {data.venues.map(venue => {
      const vc  = VENUE_COLOR[venue.type];
      const vbg = VENUE_BG[venue.type];
      const { booked, available, total } = venue.slots;
      const pct = total > 0 ? Math.round((booked / total) * 100) : 0;
      return (
        <View key={venue.id} style={s.slotCard}>
          <View style={s.venueHeader}>
            <View style={[s.iconWrap, { backgroundColor: vbg }]}>
              <VenueIcon type={venue.type} size={20} color={vc} />
            </View>
            <View style={{ flex: 1, marginLeft: responsiveWidth(3) }}>
              <Text style={s.venueName}>{venue.name}</Text>
              <Text style={s.venueAddr} numberOfLines={1}>{venue.address}</Text>
            </View>
            <View style={[s.pctBadge, { backgroundColor: vbg }]}>
              <Text style={[s.pctBadgeText, { color: vc }]}>{pct}%</Text>
            </View>
          </View>
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${pct}%` as any, backgroundColor: vc }]} />
          </View>
          <View style={s.slotGrid}>
            {Array.from({ length: total }).map((_, i) => {
              const isMonthly = venue.monthlyChargeEnabled && i < venue.activeMonthlySubscriptions;
              const isBooked  = i < booked;
              return (
                <View key={i} style={[s.slotBox, {
                  backgroundColor: isMonthly ? C.brandLight : isBooked ? vbg      : C.successBg,
                  borderColor:     isMonthly ? C.brand      : isBooked ? vc       : C.success,
                }]}>
                  <View style={[s.slotDot, {
                    backgroundColor: isMonthly ? C.brand : isBooked ? vc : C.success,
                  }]} />
                </View>
              );
            })}
          </View>
          <View style={s.slotLegend}>
            {[
              { color: C.success, label: `${available} Free` },
              { color: vc,        label: `${booked - venue.activeMonthlySubscriptions} Hourly` },
              ...(venue.monthlyChargeEnabled
                ? [{ color: C.brand, label: `${venue.activeMonthlySubscriptions} Monthly` }]
                : []),
            ].map(item => (
              <View key={item.label} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: item.color }]} />
                <Text style={s.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    })}
  </ScrollView>
);

// ─────────────────────────────────────────────────────────────
// BookingsTab — FIXED: filter chips moved into ListHeaderComponent
// so spacing between chips and first card is always consistent
// ─────────────────────────────────────────────────────────────
const BookingsTab = ({ data }: { data: DashboardData }) => {
  const [filter, setFilter] = useState<'all' | VenueType>('all');
  const filtered = filter === 'all'
    ? data.recentBookings
    : data.recentBookings.filter(b => b.type === filter);

  const FilterBar = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.filterRow}
      decelerationRate="fast"
    >
      {(['all', 'parking', 'garage', 'residence'] as const).map(f => {
        const active = filter === f;
        const vc  = f === 'all' ? C.brand : VENUE_COLOR[f as VenueType];
        const vbg = f === 'all' ? C.brandLight : VENUE_BG[f as VenueType];
        return (
          <TouchableOpacity
            key={f}
            style={[
              s.filterChip,
              active && s.filterChipActive,
              { backgroundColor: active ? vc : vbg, borderColor: vc },
            ]}
            onPress={() => setFilter(f)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {f !== 'all' && (
              <VenueIcon
                type={f as VenueType}
                size={14}
                color={active ? '#fff' : vc}
              />
            )}
            <Text style={[s.filterChipText, { color: active ? '#fff' : vc }]}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <FlatList
      data={filtered}
      keyExtractor={b => b._id}
      renderItem={({ item }) => <BookingRow booking={item} />}
      // ✅ Filter bar is now PART of the list — no separate View wrapper
      // This ensures the gap between chips and first card is always identical
      ListHeaderComponent={FilterBar}
      contentContainerStyle={s.bookingsListContent}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={s.emptyWrap}>
          <CalendarDays size={40} color={C.lightGray} />
          <Text style={s.emptyText}>No bookings found</Text>
        </View>
      }
    />
  );
};

const MonthlyTab = ({ data }: { data: DashboardData }) => {
  const totalMRR  = data.venues.filter(v => v.monthlyChargeEnabled)
    .reduce((s, v) => s + v.monthlyRate * v.activeMonthlySubscriptions, 0);
  const totalSubs = data.venues.filter(v => v.monthlyChargeEnabled)
    .reduce((s, v) => s + v.activeMonthlySubscriptions, 0);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabContent}>
      <View style={s.mrrHero}>
        <View>
          <Text style={s.mrrHeroLabel}>Monthly Recurring Revenue</Text>
          <Text style={[s.mrrHeroValue, { color: C.brand }]}>${totalMRR.toLocaleString()}</Text>
          <Text style={s.mrrHeroSub}>{totalSubs} active subscribers</Text>
        </View>
        <View style={[s.iconWrap, { backgroundColor: C.brandLight, width: 52, height: 52, borderRadius: 16 }]}>
          <Repeat size={26} color={C.brand} />
        </View>
      </View>

      {data.venues.filter(v => v.monthlyChargeEnabled).length > 0 && (
        <View style={s.breakdownCard}>
          {data.venues.filter(v => v.monthlyChargeEnabled).map((v, i, arr) => (
            <View
              key={v.id}
              style={[s.breakdownRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}
            >
              <View style={[s.breakdownDot, { backgroundColor: VENUE_COLOR[v.type] }]} />
              <Text style={s.breakdownName} numberOfLines={1}>{v.name}</Text>
              <Text style={s.breakdownSubs}>{v.activeMonthlySubscriptions} subs</Text>
              <Text style={[s.breakdownAmt, { color: VENUE_COLOR[v.type] }]}>
                ${(v.monthlyRate * v.activeMonthlySubscriptions).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      )}

      <SectionTitle title="Monthly Plan Overview" />
      {data.venues.map(v => (
        <MonthlyVenueCard key={v.id} venue={v} />
      ))}

      <View style={s.infoBox}>
        <Text style={s.infoText}>
          Monthly plan rates are configured during venue registration.
          To update a rate, edit the venue from your venue management screen.
        </Text>
      </View>
    </ScrollView>
  );
};

// ─────────────────────────────────────────────────────────────
// Tab config
// ─────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview',    label: 'Overview', Icon: LayoutDashboard },
  { key: 'slots',       label: 'Slots',    Icon: Grid            },
  { key: 'bookings',    label: 'Bookings', Icon: List            },
  { key: 'monthly',     label: 'Monthly',  Icon: Repeat          },
  { key: 'dryCleaning', label: 'Laundry',  Icon: Shirt           },
] as const;
type TabKey = typeof TABS[number]['key'];

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
const MerchantDashboard: React.FC = () => {
  const router = useRouter();
  const { token, user } = useSelector((state: any) => state.auth);

  const [activeTab,  setActiveTab]  = useState<TabKey>('overview');
  const [period,     setPeriod]     = useState<PeriodKey>('weekly');
  const [data,       setData]       = useState<DashboardData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const tabIndicator = useRef(new Animated.Value(0)).current;
  const TAB_W = SCREEN_WIDTH / TABS.length;

  const fetchData = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/merchants/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = res.data?.data ?? res.data;
      const normalised: DashboardData = {
        totalEarnings: payload.totalEarnings,
        totalBookings: payload.totalBookings,
        venues: (payload.venues ?? []).map((v: VenueSummary) => ({
          ...v,
          recentBookings: (v.recentBookings ?? []).map((b: BookingSummary) => ({
            ...b,
            from: typeof b.from === 'string' ? b.from : new Date(b.from).toISOString(),
            to:   typeof b.to   === 'string' ? b.to   : new Date(b.to).toISOString(),
          })),
        })),
        recentBookings: (payload.recentBookings ?? []).map((b: BookingSummary) => ({
          ...b,
          from: typeof b.from === 'string' ? b.from : new Date(b.from).toISOString(),
          to:   typeof b.to   === 'string' ? b.to   : new Date(b.to).toISOString(),
        })),
      };
      setData(normalised);
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const handleTabChange = useCallback((key: TabKey) => {
    const idx = TABS.findIndex(t => t.key === key);
    Animated.spring(tabIndicator, {
      toValue: idx * TAB_W, useNativeDriver: true, tension: 80, friction: 12,
    }).start();
    setActiveTab(key);
  }, [TAB_W]);

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <ActivityIndicator size="large" color={C.brand} />
        <Text style={s.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={s.loadingWrap}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <Text style={s.loadingText}>Could not load dashboard.</Text>
        <TouchableOpacity style={s.retryBtn} onPress={handleRefresh}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: responsiveWidth(3) }}>
          <ArrowLeft size={22} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Dashboard</Text>
          <Text style={s.headerSub}>
            {user?.firstName ? `Welcome, ${user.firstName}` : 'Business overview'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={s.headerRefresh}>
          <RefreshCw size={20} color={C.brand} />
        </TouchableOpacity>
      </View>

      <View style={s.tabBar}>
        <Animated.View style={[s.tabIndicator, { width: TAB_W, transform: [{ translateX: tabIndicator }] }]} />
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tabBtn, { width: TAB_W }]}
              onPress={() => handleTabChange(tab.key)}
              activeOpacity={0.75}
            >
              <tab.Icon size={18} color={active ? C.brand : C.gray} />
              <Text style={[s.tabLabel, active && { color: C.brand, fontWeight: '700' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {activeTab === 'overview'    && <OverviewTab  data={data} period={period} onPeriodChange={setPeriod} />}
        {activeTab === 'slots'       && <SlotsTab     data={data} />}
        {activeTab === 'bookings'    && <BookingsTab  data={data} />}
        {activeTab === 'monthly'     && <MonthlyTab   data={data} />}
        {activeTab === 'dryCleaning' && <DryCleaningTab token={token} />}
      </View>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg ,marginTop:-40 },
  loadingWrap:  { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:  { fontSize: responsiveFontSize(1.8), color: C.gray, textAlign: 'center' },
  retryBtn:     { marginTop: 8, backgroundColor: C.brand, paddingHorizontal: responsiveWidth(8), paddingVertical: responsiveHeight(1.5), borderRadius: 30, shadowColor: C.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: responsiveFontSize(1.8) },

  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: responsiveWidth(5), paddingVertical: responsiveHeight(2), backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  headerTitle:   { fontSize: responsiveFontSize(2.8), fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  headerSub:     { fontSize: responsiveFontSize(1.6), color: C.gray, marginTop: 2 },
  headerRefresh: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.brandLight, justifyContent: 'center', alignItems: 'center', shadowColor: C.brand, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 1 },

  tabBar:       { flexDirection: 'row', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 2, elevation: 1 },
  tabIndicator: { position: 'absolute', bottom: 0, height: 3, backgroundColor: C.brand, borderRadius: 3 },
  tabBtn:       { alignItems: 'center', justifyContent: 'center', paddingVertical: responsiveHeight(1.4), gap: 4 },
  tabLabel:     { fontSize: responsiveFontSize(1.4), color: C.gray, letterSpacing: 0.2, fontWeight: '600' },

  tabContent:   { padding: responsiveWidth(5), paddingBottom: responsiveHeight(5) },
  sectionTitle: { fontSize: responsiveFontSize(1.8), fontWeight: '800', color: C.gray, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: responsiveHeight(1.5), marginTop: responsiveHeight(0.8) },

  periodRow:           { flexDirection: 'row', backgroundColor: C.lightGray, borderRadius: 60, padding: 4, gap: 4, marginBottom: responsiveHeight(1) },
  periodBtn:           { flex: 1, paddingVertical: responsiveHeight(0.9), borderRadius: 40, alignItems: 'center' },
  periodBtnActive:     { backgroundColor: C.card, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  periodBtnText:       { fontSize: responsiveFontSize(1.6), fontWeight: '600', color: C.gray },
  periodBtnTextActive: { color: C.brand },

  heroRow:   { flexDirection: 'row', gap: responsiveWidth(3), marginTop: responsiveHeight(2) },
  statCard:  { flex: 1, backgroundColor: C.card, borderRadius: 20, padding: responsiveWidth(4.5), borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  statLabel: { fontSize: responsiveFontSize(1.5), color: C.gray, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, fontWeight: '600' },
  statValue: { fontSize: responsiveFontSize(3.2), fontWeight: '900', letterSpacing: -0.5 },
  statSub:   { fontSize: responsiveFontSize(1.4), color: C.gray, marginTop: 4 },

  typeStrip:    { flexDirection: 'row', backgroundColor: C.card, borderRadius: 24, padding: responsiveWidth(4.5), marginTop: responsiveHeight(2), borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  typeItem:     { flex: 1, alignItems: 'center', gap: 6 },
  typeIconWrap: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  typeValue:    { fontSize: responsiveFontSize(2), fontWeight: '800' },
  typeLabel:    { fontSize: responsiveFontSize(1.3), color: C.gray, fontWeight: '500' },

  venueCard:     { backgroundColor: C.card, borderRadius: 20, padding: responsiveWidth(4.5), marginBottom: responsiveHeight(1.6), borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 5, elevation: 2 },
  venueHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: responsiveHeight(1.2) },
  iconWrap:      { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  venueName:     { fontSize: responsiveFontSize(2), fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  venueAddr:     { fontSize: responsiveFontSize(1.5), color: C.gray, marginTop: 3 },
  venueType:     { fontSize: responsiveFontSize(1.5), color: C.gray, marginTop: 2 },
  earningPill:   { paddingHorizontal: responsiveWidth(3.5), paddingVertical: 6, borderRadius: 40 },
  earningPillText:{ fontSize: responsiveFontSize(1.9), fontWeight: '800' },

  occRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  occLabel: { fontSize: responsiveFontSize(1.5), color: C.gray, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  occPct:   { fontSize: responsiveFontSize(1.8), fontWeight: '800' },
  barBg:    { height: 8, backgroundColor: C.lightGray, borderRadius: 6, marginBottom: responsiveHeight(1.2), overflow: 'hidden' },
  barFill:  { height: 8, borderRadius: 6 },

  slotRow:       { flexDirection: 'row', alignItems: 'center', gap: responsiveWidth(4), flexWrap: 'wrap', marginTop: 4 },
  slotItem:      { alignItems: 'center', gap: 3 },
  slotNum:       { fontSize: responsiveFontSize(2), fontWeight: '800' },
  slotItemLabel: { fontSize: responsiveFontSize(1.3), color: C.gray, fontWeight: '500' },
  monthlyTag:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto' as any, backgroundColor: C.brandLight, paddingHorizontal: responsiveWidth(2.5), paddingVertical: 5, borderRadius: 40 },
  monthlyTagText:{ fontSize: responsiveFontSize(1.3), fontWeight: '800', color: C.brand },

  bookingRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: responsiveHeight(1.6), paddingHorizontal: responsiveWidth(5), borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  bookingIcon:     { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: responsiveWidth(3) },
  bookingTopLine:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  bookingName:     { fontSize: responsiveFontSize(1.8), fontWeight: '700', color: C.text, flexShrink: 1 },
  bookingSlot:     { fontSize: responsiveFontSize(1.5), color: C.gray, fontWeight: '500' },
  bookingRight:    { alignItems: 'flex-end', gap: 5 },
  bookingAmt:      { fontSize: responsiveFontSize(1.9), fontWeight: '800', color: C.text },
  monthlyBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.brandLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  monthlyBadgeText:{ fontSize: responsiveFontSize(1.3), fontWeight: '800', color: C.brand },
  activeDot:       { width: 8, height: 8, borderRadius: 5, backgroundColor: C.success },
  statusPill:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusPillText:  { fontSize: responsiveFontSize(1.2), fontWeight: '800' },

  // ✅ FIXED: filterRow now has consistent, fixed vertical padding
  // Previously paddingVertical caused variable gaps when switching tabs
  filterRow: {
    paddingHorizontal: responsiveWidth(5),
    paddingTop: responsiveHeight(1.5),
    paddingBottom: responsiveHeight(1.5),
    gap: responsiveWidth(2.5),
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: responsiveWidth(4),
    paddingVertical: responsiveHeight(1.2),
    borderRadius: 40,
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  filterChipActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  filterChipText: {
    fontSize: responsiveFontSize(1.6),
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ✅ FIXED: bookingsListContent replaces the old separate contentContainerStyle
  // No extra top padding — header component handles it
  bookingsListContent: {
    paddingBottom: responsiveHeight(3),
    flexGrow: 1,
  },

  emptyWrap:      { alignItems: 'center', paddingTop: responsiveHeight(10), gap: 15 },
  emptyText:      { fontSize: responsiveFontSize(1.8), color: C.gray, fontWeight: '500' },

  slotCard:    { backgroundColor: C.card, borderRadius: 20, marginBottom: responsiveHeight(1.8), borderWidth: 1, borderColor: C.border, overflow: 'hidden', padding: responsiveWidth(4.5), shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  pctBadge:    { paddingHorizontal: responsiveWidth(3), paddingVertical: 5, borderRadius: 30 },
  pctBadgeText:{ fontSize: responsiveFontSize(1.6), fontWeight: '800' },
  slotGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: responsiveHeight(1.2), marginTop: responsiveHeight(0.8) },
  slotBox:     { width: 24, height: 24, borderRadius: 6, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  slotDot:     { width: 10, height: 10, borderRadius: 5 },
  slotLegend:  { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 4 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendText:  { fontSize: responsiveFontSize(1.4), color: C.gray, fontWeight: '500' },

  mrrHero:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: 24, padding: responsiveWidth(5.5), borderWidth: 1, borderColor: C.border, marginBottom: responsiveHeight(1.8), shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  mrrHeroLabel: { fontSize: responsiveFontSize(1.5), color: C.gray, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5, fontWeight: '600' },
  mrrHeroValue: { fontSize: responsiveFontSize(4.8), fontWeight: '900', letterSpacing: -0.8 },
  mrrHeroSub:   { fontSize: responsiveFontSize(1.5), color: C.gray, marginTop: 4 },

  breakdownCard: { backgroundColor: C.card, borderRadius: 20, marginBottom: responsiveHeight(1.8), borderWidth: 1, borderColor: C.border, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  breakdownRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: responsiveHeight(1.5), paddingHorizontal: responsiveWidth(5), gap: 12 },
  breakdownDot:  { width: 10, height: 10, borderRadius: 5 },
  breakdownName: { flex: 1, fontSize: responsiveFontSize(1.7), color: C.text, fontWeight: '700' },
  breakdownSubs: { fontSize: responsiveFontSize(1.5), color: C.gray, fontWeight: '500' },
  breakdownAmt:  { fontSize: responsiveFontSize(1.8), fontWeight: '800', minWidth: 65, textAlign: 'right' },

  mCard:        { backgroundColor: C.card, borderRadius: 20, marginBottom: responsiveHeight(1.6), borderWidth: 1, borderColor: C.border, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  mCardHeader:  { flexDirection: 'row', alignItems: 'center', padding: responsiveWidth(4.5) },
  mCardBody:    { paddingHorizontal: responsiveWidth(4.5), paddingBottom: responsiveWidth(4.5) },
  mRateRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: responsiveHeight(1.5) },
  mRateLabel:   { fontSize: responsiveFontSize(1.6), color: C.gray, fontWeight: '600' },
  mRateValue:   { fontSize: responsiveFontSize(2.6), fontWeight: '900', letterSpacing: -0.5 },
  mRateSuffix:  { fontSize: responsiveFontSize(1.5), fontWeight: '500', color: C.gray },
  mStatsRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.lightGray, borderRadius: 16, padding: responsiveWidth(3.5) },
  mStatItem:    { flex: 1, alignItems: 'center' },
  mStatNum:     { fontSize: responsiveFontSize(2), fontWeight: '800', color: C.text },
  mStatLabel:   { fontSize: responsiveFontSize(1.3), color: C.gray, marginTop: 3, fontWeight: '500' },
  mStatsDivider:{ width: 1, height: 30, backgroundColor: C.border },
  enabledPill:  { paddingHorizontal: responsiveWidth(3), paddingVertical: 4, borderRadius: 30 },
  enabledPillText:{ fontSize: responsiveFontSize(1.3), fontWeight: '800' },

  infoBox:  { backgroundColor: C.lightGray, borderRadius: 18, padding: responsiveWidth(5), marginTop: 6 },
  infoText: { fontSize: responsiveFontSize(1.5), color: C.gray, lineHeight: responsiveHeight(2.6), textAlign: 'center' },

  mrrBanner:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.brandLight, borderRadius: 20, padding: responsiveWidth(4.5), borderWidth: 1, borderColor: C.brand + '30', marginTop: 6, shadowColor: C.brand, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5, elevation: 2 },
  mrrBannerTitle: { fontSize: responsiveFontSize(1.7), fontWeight: '800', color: C.text },
  mrrBannerSub:   { fontSize: responsiveFontSize(1.4), color: C.gray, marginTop: 2 },
  mrrBannerValue: { fontSize: responsiveFontSize(2.8), fontWeight: '900', letterSpacing: -0.5 },
});

export default MerchantDashboard;