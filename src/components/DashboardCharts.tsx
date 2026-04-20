'use client';

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts';

interface DashboardChartsProps {
  onlineRevenue: number;
  coinRevenue: number;
  onlineCount: number;
  coinCount: number;
  machineHealthData: { name: string; online: number; offline: number; revenue: number }[];
  revenueTimeline: { date: string; online: number; coin: number }[];
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

const formatRupee = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function PaymentDonutChart({ onlineRevenue, coinRevenue, onlineCount, coinCount }: Pick<DashboardChartsProps, 'onlineRevenue' | 'coinRevenue' | 'onlineCount' | 'coinCount'>) {
  const data = [
    { name: 'Online', value: onlineRevenue, count: onlineCount },
    { name: 'Coin', value: coinRevenue, count: coinCount },
  ].filter(d => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
        No transaction data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(val: number, name: string, props: any) => [
            [`₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Revenue'],
            [`${props.payload.count} transactions`, ''],
          ].flat()}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MachineRevenueBar({ machineHealthData }: Pick<DashboardChartsProps, 'machineHealthData'>) {
  const data = machineHealthData.slice(0, 8);
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">No machine data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: '#6b7280' }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={formatRupee} width={60} />
        <Tooltip formatter={(v: number) => formatRupee(v)} />
        <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueAreaChart({ revenueTimeline }: Pick<DashboardChartsProps, 'revenueTimeline'>) {
  if (revenueTimeline.length === 0) {
    return <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">No timeline data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={revenueTimeline} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="onlineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="coinGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={formatRupee} width={60} />
        <Tooltip formatter={(v: number) => formatRupee(v)} />
        <Legend />
        <Area type="monotone" dataKey="online" name="Online" stroke="#6366f1" fill="url(#onlineGrad)" strokeWidth={2} />
        <Area type="monotone" dataKey="coin" name="Coin" stroke="#f59e0b" fill="url(#coinGrad)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MachineStatusBar({ online, offline, total }: { online: number; offline: number; total: number }) {
  const pct = total > 0 ? Math.round((online / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{online} online / {offline} offline</span>
        <span className="font-semibold text-gray-900 dark:text-white">{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
        <div
          className="h-3 rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct > 70 ? '#10b981' : pct > 40 ? '#f59e0b' : '#ef4444',
          }}
        />
      </div>
    </div>
  );
}
