'use client';

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, Legend,
} from 'recharts';

interface DashboardChartsProps {
  onlineRevenue: number;
  coinRevenue: number;
  rfidRevenue: number;
  onlineCount: number;
  coinCount: number;
  rfidCount: number;
  machineHealthData: { name: string; online: number; offline: number; revenue: number }[];
  revenueTimeline: { date: string; online: number; coin: number; rfid: number }[];
}

const PALETTE = ['#0071e3', '#1d1d1f', '#6e6e73', '#9a6400', '#1d7a3c', '#a1a1a6'];
const GRID_COLOR  = '#f5f5f7';
const AXIS_COLOR  = '#86868b';
const TOOLTIP_STYLE = {
  backgroundColor: '#1d1d1f',
  border: '1px solid #1d1d1f',
  borderRadius: 12,
  color: '#fff',
  fontSize: 12,
};

const formatRupee = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function PaymentDonutChart({
  onlineRevenue, coinRevenue, rfidRevenue, onlineCount, coinCount, rfidCount,
}: Pick<DashboardChartsProps, 'onlineRevenue' | 'coinRevenue' | 'rfidRevenue' | 'onlineCount' | 'coinCount' | 'rfidCount'>) {
  const data = [
    { name: 'Online', value: onlineRevenue, count: onlineCount },
    { name: 'Coin',   value: coinRevenue,   count: coinCount   },
    { name: 'RFID',   value: rfidRevenue,   count: rfidCount   },
  ].filter(d => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm" style={{ color: '#86868b' }}>
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
          paddingAngle={4}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i]} strokeWidth={0} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(val: number, name: string, props: any) => [
            `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            `${props.payload.count} transactions`,
          ]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MachineRevenueBar({
  machineHealthData,
}: Pick<DashboardChartsProps, 'machineHealthData'>) {
  const data = machineHealthData.slice(0, 8);
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm" style={{ color: '#86868b' }}>
        No machine data
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: AXIS_COLOR }}
          angle={-35}
          textAnchor="end"
          interval={0}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: AXIS_COLOR }}
          tickFormatter={formatRupee}
          width={58}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatRupee(v)} />
        <Bar dataKey="revenue" name="Revenue" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueAreaChart({
  revenueTimeline,
}: Pick<DashboardChartsProps, 'revenueTimeline'>) {
  if (revenueTimeline.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm" style={{ color: '#86868b' }}>
        No timeline data
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={revenueTimeline} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="onlineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#0071e3" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#0071e3" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="coinGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#9a6400" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#9a6400" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="rfidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6e6e73" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6e6e73" stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: AXIS_COLOR }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: AXIS_COLOR }}
          tickFormatter={formatRupee}
          width={58}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatRupee(v)} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: AXIS_COLOR }}
          iconType="circle"
          iconSize={8}
        />
        <Area type="monotone" dataKey="online" name="Online" stroke="#0071e3" fill="url(#onlineGrad)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="coin"   name="Coin"   stroke="#9a6400" fill="url(#coinGrad)"   strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="rfid"   name="RFID"   stroke="#6e6e73" fill="url(#rfidGrad)"   strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MachineStatusBar({ online, offline, total }: { online: number; offline: number; total: number }) {
  const pct = total > 0 ? Math.round((online / total) * 100) : 0;
  const barColor = pct > 70 ? '#1d7a3c' : pct > 40 ? '#9a6400' : '#0071e3';
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span style={{ color: '#6e6e73' }}>{online} online · {offline} offline</span>
        <span className="font-semibold text-[#1d1d1f]">{pct}%</span>
      </div>
      <div className="w-full rounded-full h-2.5 overflow-hidden" style={{ background: '#f5f5f7' }}>
        <div
          className="h-2.5 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${barColor}cc, ${barColor})` }}
        />
      </div>
    </div>
  );
}
