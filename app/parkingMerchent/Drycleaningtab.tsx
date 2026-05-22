/**
 * DryCleaningTab.tsx
 *
 * Drop-in tab for the existing MerchantDashboard.
 *
 * USAGE — add to MerchantDashboard.tsx:
 *
 *   1. Import this component:
 *        import DryCleaningTab from './DryCleaningTab';
 *
 *   2. Add a tab entry to the TABS array:
 *        { key: 'dryCleaning', label: 'Laundry', Icon: Shirt }
 *
 *   3. Add to the tab content render block:
 *        {activeTab === 'dryCleaning' && <DryCleaningTab token={token} />}
 *
 *   4. Route: GET /merchants/dry-cleaner-stats
 *      (wire getDryCleanerStats controller to this route)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import {
  ShoppingBag,
  TrendingUp,
  Clock,
  CheckCircle,
  Truck,
  Package,
  Star,
  ChevronRight,
  AlertCircle,
  BarChart2,
  Layers,
  RefreshCw,
} from 'lucide-react-native';
import { responsiveHeight, responsiveWidth, responsiveFontSize } from 'react-native-responsive-dimensions';
import axiosInstance from '../../api/axios';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type PeriodKey = 'daily' | 'weekly' | 'monthly';

interface PeriodTotals { daily: number; weekly: number; monthly: number; }

interface CategoryBreakdown {
  category: string;
  totalOrders: number;
  totalRevenue: number;
  totalItems: number;
}

interface StatusBreakdown {
  status: string;
  count: number;
}

interface RecentOrder {
  _id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  itemCount: number;
  scheduledPickup: string | null;
  scheduledDelivery: string | null;
  createdAt: string;
}

interface ShopStat {
  id: string;
  shopname: string;
  address: { street?: string; city?: string; state?: string };
  phoneNumber: string;
  contactPerson: string;
  rating: number;
  earnings: PeriodTotals;
  bookingCounts: PeriodTotals;
  orderStatus: {
    pending: number;
    active: number;
    readyForDelivery: number;
    total: number;
    paid: number;
  };
  totalServices: number;
  servicesByCategory: Record<string, number>;
  allTimeRevenue: number;
  recentOrders: RecentOrder[];
}

interface DryCleanerData {
  totalEarnings: PeriodTotals;
  totalBookings: PeriodTotals;
  shops: ShopStat[];
  recentOrders: RecentOrder[];
  categoryBreakdown: CategoryBreakdown[];
  statusBreakdown: StatusBreakdown[];
  overallStats: {
    totalShops: number;
    totalServices: number;
    totalOrdersAllTime: number;
    avgOrderValue: number;
  };
}

interface Props {
  token: string;
}

// ─────────────────────────────────────────────────────────────
// Design tokens (mirrors parent dashboard palette)
// ─────────────────────────────────────────────────────────────

const C = {
  bg:         '#FAFAFA',
  card:       '#FFFFFF',
  brand:      '#FF6B35',   // warm orange — distinct from parking blue
  brandLight: '#FFF3EE',
  text:       '#1A1A2E',
  gray:       '#6B7280',
  lightGray:  '#F3F4F6',
  border:     '#EBEBEB',
  success:    '#22C55E',
  successBg:  '#F0FDF4',
  warning:    '#F59E0B',
  warningBg:  '#FFFBEB',
  error:      '#EF4444',
  errorBg:    '#FFF1F1',
  purple:     '#8B5CF6',
  purpleBg:   '#F5F3FF',
  teal:       '#14B8A6',
  tealBg:     '#F0FDFA',
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  pending:             { label: 'Pending',          color: C.warning, bg: C.warningBg, Icon: Clock       },
  accepted:            { label: 'Accepted',         color: C.brand,   bg: C.brandLight, Icon: CheckCircle },
  in_progress:         { label: 'In Progress',      color: C.purple,  bg: C.purpleBg,  Icon: Truck       },
  pickup_completed:    { label: 'Picked Up',        color: C.teal,    bg: C.tealBg,    Icon: Package     },
  en_route_to_dropoff: { label: 'En Route',         color: C.purple,  bg: C.purpleBg,  Icon: Truck       },
  arrived_at_dropoff:  { label: 'Arrived',          color: C.teal,    bg: C.tealBg,    Icon: Package     },
  dropped_at_center:   { label: 'At Cleaners',      color: C.brand,   bg: C.brandLight, Icon: ShoppingBag },
  ready_for_delivery:  { label: 'Ready',            color: C.success, bg: C.successBg, Icon: CheckCircle },
  completed:           { label: 'Completed',        color: C.success, bg: C.successBg, Icon: CheckCircle },
  cancelled:           { label: 'Cancelled',        color: C.error,   bg: C.errorBg,   Icon: AlertCircle },
  rejected:            { label: 'Rejected',         color: C.error,   bg: C.errorBg,   Icon: AlertCircle },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const PERIOD_LABELS: Record<PeriodKey, string> = {
  daily: 'Today', weekly: 'This Week', monthly: 'This Month',
};

const CATEGORY_COLORS = [C.brand, C.purple, C.teal, C.success, C.warning, '#EC4899', '#06B6D4', '#84CC16'];

// ─────────────────────────────────────────────────────────────
// Sub-components
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

const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
  <View style={{ marginBottom: responsiveHeight(1.2), marginTop: responsiveHeight(0.5) }}>
    <Text style={s.sectionTitle}>{title}</Text>
    {sub ? <Text style={s.sectionSub}>{sub}</Text> : null}
  </View>
);

const StatCard = ({
  label, value, sub, color, Icon,
}: { label: string; value: string; sub?: string; color: string; Icon: any }) => (
  <View style={[s.statCard, { borderLeftColor: color }]}>
    <View style={[s.statIconWrap, { backgroundColor: color + '18' }]}>
      <Icon size={18} color={color} />
    </View>
    <Text style={s.statLabel}>{label}</Text>
    <Text style={[s.statValue, { color }]}>{value}</Text>
    {sub ? <Text style={s.statSub}>{sub}</Text> : null}
  </View>
);

const OrderRow = ({ order }: { order: RecentOrder }) => {
  const meta = STATUS_META[order.status] ?? STATUS_META['pending'];
  const StatusIcon = meta.Icon;
  return (
    <View style={s.orderRow}>
      <View style={[s.orderIconWrap, { backgroundColor: meta.bg }]}>
        <StatusIcon size={16} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.orderTopLine}>
          <Text style={s.orderNum}>{order.orderNumber}</Text>
          <View style={[s.statusPill, { backgroundColor: meta.bg }]}>
            <Text style={[s.statusPillText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={s.orderCustomer}>{order.customerName} · {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}</Text>
        {order.scheduledPickup && (
          <Text style={s.orderDate}>Pickup: {fmtDate(order.scheduledPickup)}</Text>
        )}
      </View>
      <Text style={s.orderAmt}>{fmt(order.totalAmount)}</Text>
    </View>
  );
};

const CategoryBar = ({ item, maxRevenue, color }: { item: CategoryBreakdown; maxRevenue: number; color: string }) => {
  const pct = maxRevenue > 0 ? (item.totalRevenue / maxRevenue) * 100 : 0;
  return (
    <View style={s.catRow}>
      <View style={s.catLabelRow}>
        <Text style={s.catName}>{item.category}</Text>
        <Text style={[s.catRevenue, { color }]}>{fmt(item.totalRevenue)}</Text>
      </View>
      <View style={s.catBarBg}>
        <View style={[s.catBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <View style={s.catMetaRow}>
        <Text style={s.catMeta}>{item.totalOrders} order{item.totalOrders !== 1 ? 's' : ''}</Text>
        <Text style={s.catMeta}>{item.totalItems} item{item.totalItems !== 1 ? 's' : ''}</Text>
      </View>
    </View>
  );
};

const ShopCard = ({ shop, period }: { shop: ShopStat; period: PeriodKey }) => {
  const [expanded, setExpanded] = useState(false);
  const occupancyPct = shop.orderStatus.total > 0
    ? Math.round((shop.orderStatus.active / Math.max(shop.orderStatus.total, 1)) * 100) : 0;

  return (
    <View style={s.shopCard}>
      {/* Header */}
      <TouchableOpacity style={s.shopHeader} onPress={() => setExpanded(!expanded)} activeOpacity={0.85}>
        <View style={[s.shopIconWrap, { backgroundColor: C.brandLight }]}>
          <ShoppingBag size={20} color={C.brand} />
        </View>
        <View style={{ flex: 1, marginLeft: responsiveWidth(3) }}>
          <Text style={s.shopName} numberOfLines={1}>{shop.shopname}</Text>
          <Text style={s.shopAddr} numberOfLines={1}>
            {shop.address.street ? `${shop.address.street}, ` : ''}{shop.address.city ?? ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={[s.shopEarning, { color: C.brand }]}>{fmt(shop.earnings[period])}</Text>
          {shop.rating > 0 && (
            <View style={s.ratingRow}>
              <Star size={11} color={C.warning} fill={C.warning} />
              <Text style={s.ratingText}>{shop.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <ChevronRight
          size={16}
          color={C.gray}
          style={{ marginLeft: 4, transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
        />
      </TouchableOpacity>

      {/* Status strip */}
      <View style={s.shopStatusStrip}>
        {[
          { label: 'Pending', value: shop.orderStatus.pending, color: C.warning },
          { label: 'Active',  value: shop.orderStatus.active,  color: C.brand   },
          { label: 'Ready',   value: shop.orderStatus.readyForDelivery, color: C.success },
          { label: 'Done',    value: shop.orderStatus.paid,    color: C.gray    },
        ].map(item => (
          <View key={item.label} style={s.shopStatusItem}>
            <Text style={[s.shopStatusNum, { color: item.color }]}>{item.value}</Text>
            <Text style={s.shopStatusLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Bookings period row */}
      <View style={s.shopBookingRow}>
        <Text style={s.shopBookingLabel}>Orders {PERIOD_LABELS[period]}</Text>
        <Text style={[s.shopBookingValue, { color: C.brand }]}>{shop.bookingCounts[period]}</Text>
      </View>

      {/* Expanded detail */}
      {expanded && (
        <View style={s.shopExpanded}>
          <View style={s.divider} />

          {/* Services by category */}
          {Object.keys(shop.servicesByCategory).length > 0 && (
            <>
              <Text style={s.expandLabel}>Services ({shop.totalServices})</Text>
              <View style={s.catChips}>
                {Object.entries(shop.servicesByCategory).map(([cat, count], i) => (
                  <View key={cat} style={[s.catChip, { backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] + '18', borderColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] + '40' }]}>
                    <Text style={[s.catChipText, { color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }]}>
                      {cat} ({count})
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* All-time revenue */}
          <View style={s.allTimeRow}>
            <TrendingUp size={14} color={C.success} />
            <Text style={s.allTimeLabel}>All-time Revenue</Text>
            <Text style={[s.allTimeValue, { color: C.success }]}>{fmt(shop.allTimeRevenue)}</Text>
          </View>

          {/* Recent orders for this shop */}
          {shop.recentOrders.length > 0 && (
            <>
              <Text style={[s.expandLabel, { marginTop: responsiveHeight(1.2) }]}>Recent Orders</Text>
              {shop.recentOrders.slice(0, 3).map(order => (
                <OrderRow key={order._id} order={order} />
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Main exported component
// ─────────────────────────────────────────────────────────────

const DryCleaningTab: React.FC<Props> = ({ token }) => {
  const [data, setData]       = useState<DryCleanerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState<PeriodKey>('weekly');
  const [view, setView]       = useState<'overview' | 'orders' | 'analytics'>('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/merchants/dry-cleaner-stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data?.data ?? res.data);
    } catch (e) {
      console.error('DryCleanerStats fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="large" color={C.brand} />
        <Text style={s.loadingText}>Loading laundry stats…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={s.loadingWrap}>
        <AlertCircle size={40} color={C.error} />
        <Text style={s.loadingText}>Could not load dry cleaner stats.</Text>
        <TouchableOpacity style={s.retryBtn} onPress={fetchData}>
          <RefreshCw size={14} color="#fff" />
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // No shops registered
  if (data.shops.length === 0) {
    return (
      <View style={s.loadingWrap}>
        <ShoppingBag size={44} color={C.lightGray} />
        <Text style={s.loadingText}>No dry cleaning shops registered yet.</Text>
      </View>
    );
  }

  const maxCatRevenue = data.categoryBreakdown[0]?.totalRevenue ?? 1;

  // ── Sub-views ────────────────────────────────────────────────

  const OverviewView = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabContent}>
      <PeriodToggle period={period} onChange={setPeriod} />

      {/* Hero stats */}
      <View style={s.heroGrid}>
        <StatCard label="Revenue"      value={fmt(data.totalEarnings[period])}       sub={PERIOD_LABELS[period]} color={C.brand}   Icon={TrendingUp}   />
        <StatCard label="Orders"       value={String(data.totalBookings[period])}     sub={PERIOD_LABELS[period]} color={C.purple}  Icon={ShoppingBag}  />
        <StatCard label="Avg Order"    value={fmt(data.overallStats.avgOrderValue)}   sub="All time"              color={C.teal}    Icon={BarChart2}    />
        <StatCard label="All Shops"    value={String(data.overallStats.totalShops)}   sub="Registered"            color={C.success} Icon={Layers}       />
      </View>

      {/* Order pipeline summary */}
      <SectionTitle title="Order Pipeline" sub="Across all shops right now" />
      <View style={s.pipelineCard}>
        {[
          { label: 'Pending',   value: data.statusBreakdown.find(s => s.status === 'pending')?.count  ?? 0, color: C.warning },
          { label: 'Active',    value: (data.statusBreakdown.filter(s => ['accepted','in_progress','pickup_completed','en_route_to_dropoff','arrived_at_dropoff','dropped_at_center'].includes(s.status)).reduce((sum, s) => sum + s.count, 0)), color: C.brand },
          { label: 'Ready',     value: data.statusBreakdown.find(s => s.status === 'ready_for_delivery')?.count ?? 0, color: C.success },
          { label: 'Done',      value: data.statusBreakdown.find(s => s.status === 'completed')?.count ?? 0,          color: C.gray   },
        ].map((item, i, arr) => (
          <React.Fragment key={item.label}>
            <View style={s.pipelineItem}>
              <Text style={[s.pipelineNum, { color: item.color }]}>{item.value}</Text>
              <Text style={s.pipelineLabel}>{item.label}</Text>
            </View>
            {i < arr.length - 1 && <View style={s.pipelineDivider} />}
          </React.Fragment>
        ))}
      </View>

      {/* Top categories */}
      {data.categoryBreakdown.length > 0 && (
        <>
          <SectionTitle title="Top Categories" sub="By revenue — paid orders only" />
          <View style={s.catCard}>
            {data.categoryBreakdown.slice(0, 5).map((item, i) => (
              <CategoryBar
                key={item.category}
                item={item}
                maxRevenue={maxCatRevenue}
                color={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
              />
            ))}
          </View>
        </>
      )}

      {/* Shops */}
      <SectionTitle title="Your Shops" />
      {data.shops.map(shop => (
        <ShopCard key={shop.id} shop={shop} period={period} />
      ))}
    </ScrollView>
  );

  const OrdersView = () => (
    <FlatList
      data={data.recentOrders}
      keyExtractor={o => o._id}
      renderItem={({ item }) => <OrderRow order={item} />}
      contentContainerStyle={{ paddingBottom: responsiveHeight(4) }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={() => (
        <View style={{ paddingHorizontal: responsiveWidth(5), paddingTop: responsiveHeight(2), paddingBottom: responsiveHeight(1) }}>
          <Text style={s.sectionTitle}>Recent Orders</Text>
          <Text style={s.sectionSub}>Latest {data.recentOrders.length} orders across all shops</Text>
        </View>
      )}
      ListEmptyComponent={() => (
        <View style={s.emptyWrap}>
          <ShoppingBag size={40} color={C.lightGray} />
          <Text style={s.emptyText}>No orders yet</Text>
        </View>
      )}
    />
  );

  const AnalyticsView = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabContent}>
      {/* Full status breakdown */}
      <SectionTitle title="Order Status Breakdown" sub="All-time across all shops" />
      <View style={s.catCard}>
        {data.statusBreakdown.map((item, i) => {
          const meta = STATUS_META[item.status] ?? STATUS_META['pending'];
          const total = data.statusBreakdown.reduce((s, b) => s + b.count, 0);
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
          const StatusIcon = meta.Icon;
          return (
            <View key={item.status} style={s.statusBreakRow}>
              <View style={[s.statusBreakIcon, { backgroundColor: meta.bg }]}>
                <StatusIcon size={14} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.statusBreakLabelRow}>
                  <Text style={s.statusBreakLabel}>{meta.label}</Text>
                  <Text style={[s.statusBreakCount, { color: meta.color }]}>{item.count}</Text>
                </View>
                <View style={s.catBarBg}>
                  <View style={[s.catBarFill, { width: `${pct}%` as any, backgroundColor: meta.color }]} />
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Full category breakdown */}
      {data.categoryBreakdown.length > 0 && (
        <>
          <SectionTitle title="All Categories" sub="Revenue, orders, and item counts" />
          <View style={s.catCard}>
            {data.categoryBreakdown.map((item, i) => (
              <CategoryBar
                key={item.category}
                item={item}
                maxRevenue={maxCatRevenue}
                color={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
              />
            ))}
          </View>
        </>
      )}

      {/* Per-shop all-time revenue table */}
      <SectionTitle title="Shop Revenue Comparison" sub="All-time paid orders" />
      <View style={s.catCard}>
        {data.shops
          .sort((a, b) => b.allTimeRevenue - a.allTimeRevenue)
          .map((shop, i) => {
            const maxRev = data.shops[0]?.allTimeRevenue ?? 1;
            const pct = maxRev > 0 ? (shop.allTimeRevenue / maxRev) * 100 : 0;
            return (
              <View key={shop.id} style={s.shopRevRow}>
                <View style={s.shopRevLabelRow}>
                  <View style={[s.rankBadge, { backgroundColor: i === 0 ? C.warningBg : C.lightGray }]}>
                    <Text style={[s.rankBadgeText, { color: i === 0 ? C.warning : C.gray }]}>#{i + 1}</Text>
                  </View>
                  <Text style={s.shopRevName} numberOfLines={1}>{shop.shopname}</Text>
                  <Text style={[s.shopRevAmt, { color: C.brand }]}>{fmt(shop.allTimeRevenue)}</Text>
                </View>
                <View style={s.catBarBg}>
                  <View style={[s.catBarFill, { width: `${pct}%` as any, backgroundColor: C.brand }]} />
                </View>
                <Text style={s.shopRevMeta}>{shop.orderStatus.paid} paid orders · {shop.totalServices} services</Text>
              </View>
            );
          })}
      </View>
    </ScrollView>
  );

  // ── Render ────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Inner view switcher */}
      <View style={s.innerTabBar}>
        {(['overview', 'orders', 'analytics'] as const).map(v => (
          <TouchableOpacity
            key={v}
            style={[s.innerTabBtn, view === v && s.innerTabBtnActive]}
            onPress={() => setView(v)}
            activeOpacity={0.8}
          >
            <Text style={[s.innerTabText, view === v && s.innerTabTextActive]}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.refreshBtn} onPress={fetchData}>
          <RefreshCw size={14} color={C.brand} />
        </TouchableOpacity>
      </View>

      {view === 'overview'   && <OverviewView   />}
      {view === 'orders'     && <OrdersView     />}
      {view === 'analytics'  && <AnalyticsView  />}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  loadingWrap:   { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: C.bg },
  loadingText:   { fontSize: responsiveFontSize(1.8), color: C.gray, textAlign: 'center' },
  retryBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: C.brand, paddingHorizontal: responsiveWidth(6), paddingVertical: responsiveHeight(1.2), borderRadius: 10 },
  retryBtnText:  { color: '#fff', fontWeight: '700', fontSize: responsiveFontSize(1.6) },

  tabContent:    { padding: responsiveWidth(5), paddingBottom: responsiveHeight(5) },
  sectionTitle:  { fontSize: responsiveFontSize(1.6), fontWeight: '700', color: C.gray, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionSub:    { fontSize: responsiveFontSize(1.4), color: C.gray, marginTop: 2 },

  innerTabBar:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: responsiveWidth(4), paddingVertical: responsiveHeight(1) },
  innerTabBtn:       { paddingHorizontal: responsiveWidth(3.5), paddingVertical: responsiveHeight(0.7), borderRadius: 20, marginRight: 6 },
  innerTabBtnActive: { backgroundColor: C.brandLight },
  innerTabText:      { fontSize: responsiveFontSize(1.5), fontWeight: '600', color: C.gray },
  innerTabTextActive:{ color: C.brand },
  refreshBtn:        { marginLeft: 'auto' as any, width: 32, height: 32, borderRadius: 16, backgroundColor: C.brandLight, justifyContent: 'center', alignItems: 'center' },

  periodRow:           { flexDirection: 'row', backgroundColor: C.lightGray, borderRadius: 10, padding: 3, gap: 2, marginBottom: responsiveHeight(1.8) },
  periodBtn:           { flex: 1, paddingVertical: responsiveHeight(0.9), borderRadius: 8, alignItems: 'center' },
  periodBtnActive:     { backgroundColor: C.card, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  periodBtnText:       { fontSize: responsiveFontSize(1.6), fontWeight: '600', color: C.gray },
  periodBtnTextActive: { color: C.brand },

  heroGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveWidth(3), marginBottom: responsiveHeight(1.5) },
  statCard:       { width: (responsiveWidth(100) - responsiveWidth(10) - responsiveWidth(3)) / 2, backgroundColor: C.card, borderRadius: 14, padding: responsiveWidth(4), borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  statIconWrap:   { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statLabel:      { fontSize: responsiveFontSize(1.4), color: C.gray, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  statValue:      { fontSize: responsiveFontSize(2.8), fontWeight: '900' },
  statSub:        { fontSize: responsiveFontSize(1.3), color: C.gray, marginTop: 2 },

  pipelineCard:     { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, padding: responsiveWidth(4), borderWidth: 1, borderColor: C.border, marginBottom: responsiveHeight(1.5) },
  pipelineItem:     { flex: 1, alignItems: 'center' },
  pipelineNum:      { fontSize: responsiveFontSize(2.6), fontWeight: '900' },
  pipelineLabel:    { fontSize: responsiveFontSize(1.4), color: C.gray, marginTop: 2 },
  pipelineDivider:  { width: 1, backgroundColor: C.border, marginVertical: 4 },

  catCard:          { backgroundColor: C.card, borderRadius: 14, padding: responsiveWidth(4), borderWidth: 1, borderColor: C.border, marginBottom: responsiveHeight(1.5), gap: responsiveHeight(1.5) },
  catRow:           { gap: 4 },
  catLabelRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catName:          { fontSize: responsiveFontSize(1.7), fontWeight: '600', color: C.text },
  catRevenue:       { fontSize: responsiveFontSize(1.7), fontWeight: '800' },
  catBarBg:         { height: 7, backgroundColor: C.lightGray, borderRadius: 4, overflow: 'hidden' },
  catBarFill:       { height: 7, borderRadius: 4 },
  catMetaRow:       { flexDirection: 'row', justifyContent: 'space-between' },
  catMeta:          { fontSize: responsiveFontSize(1.3), color: C.gray },

  shopCard:         { backgroundColor: C.card, borderRadius: 14, marginBottom: responsiveHeight(1.2), borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  shopHeader:       { flexDirection: 'row', alignItems: 'center', padding: responsiveWidth(4) },
  shopIconWrap:     { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  shopName:         { fontSize: responsiveFontSize(1.9), fontWeight: '700', color: C.text },
  shopAddr:         { fontSize: responsiveFontSize(1.5), color: C.gray, marginTop: 2 },
  shopEarning:      { fontSize: responsiveFontSize(2), fontWeight: '900' },
  ratingRow:        { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText:       { fontSize: responsiveFontSize(1.4), fontWeight: '700', color: C.warning },
  shopStatusStrip:  { flexDirection: 'row', backgroundColor: C.lightGray, paddingVertical: responsiveHeight(1), paddingHorizontal: responsiveWidth(4) },
  shopStatusItem:   { flex: 1, alignItems: 'center' },
  shopStatusNum:    { fontSize: responsiveFontSize(2), fontWeight: '800' },
  shopStatusLabel:  { fontSize: responsiveFontSize(1.3), color: C.gray },
  shopBookingRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: responsiveWidth(4), paddingVertical: responsiveHeight(1), borderTopWidth: 1, borderTopColor: C.border },
  shopBookingLabel: { fontSize: responsiveFontSize(1.5), color: C.gray },
  shopBookingValue: { fontSize: responsiveFontSize(1.8), fontWeight: '800' },
  shopExpanded:     { paddingHorizontal: responsiveWidth(4), paddingBottom: responsiveWidth(4) },
  divider:          { height: 1, backgroundColor: C.border, marginBottom: responsiveHeight(1.2) },
  expandLabel:      { fontSize: responsiveFontSize(1.4), fontWeight: '700', color: C.gray, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  catChips:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: responsiveHeight(1.2) },
  catChip:          { paddingHorizontal: responsiveWidth(2.5), paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  catChipText:      { fontSize: responsiveFontSize(1.4), fontWeight: '700' },
  allTimeRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.successBg, borderRadius: 10, padding: responsiveWidth(3) },
  allTimeLabel:     { flex: 1, fontSize: responsiveFontSize(1.5), color: C.gray },
  allTimeValue:     { fontSize: responsiveFontSize(1.8), fontWeight: '800' },

  orderRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: responsiveHeight(1.4), paddingHorizontal: responsiveWidth(5), borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card, gap: responsiveWidth(3) },
  orderIconWrap:    { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  orderTopLine:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' },
  orderNum:         { fontSize: responsiveFontSize(1.7), fontWeight: '700', color: C.text },
  orderCustomer:    { fontSize: responsiveFontSize(1.5), color: C.gray },
  orderDate:        { fontSize: responsiveFontSize(1.3), color: C.gray, marginTop: 2 },
  orderAmt:         { fontSize: responsiveFontSize(1.8), fontWeight: '800', color: C.brand },
  statusPill:       { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  statusPillText:   { fontSize: responsiveFontSize(1.2), fontWeight: '700' },

  statusBreakRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusBreakIcon:     { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  statusBreakLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statusBreakLabel:    { fontSize: responsiveFontSize(1.5), color: C.text, fontWeight: '600' },
  statusBreakCount:    { fontSize: responsiveFontSize(1.5), fontWeight: '800' },

  shopRevRow:      { gap: 4 },
  shopRevLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankBadge:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  rankBadgeText:   { fontSize: responsiveFontSize(1.3), fontWeight: '800' },
  shopRevName:     { flex: 1, fontSize: responsiveFontSize(1.6), color: C.text, fontWeight: '600' },
  shopRevAmt:      { fontSize: responsiveFontSize(1.7), fontWeight: '800' },
  shopRevMeta:     { fontSize: responsiveFontSize(1.3), color: C.gray },

  emptyWrap:   { alignItems: 'center', paddingTop: responsiveHeight(8), gap: 12 },
  emptyText:   { fontSize: responsiveFontSize(1.8), color: C.gray },
});

export default DryCleaningTab;