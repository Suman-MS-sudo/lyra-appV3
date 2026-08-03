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

const PALETTE = ['#F43F5E', '#A78BFA', '#34D399', '#FBBF24', '#60A5FA', '#F472B6'];
const GRID_COLOR  = 'rgba(255,255,255,0.07)';
const AXIS_COLOR  = 'rgba(255,255,255,0.38)';
const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(20,6,42,0.92)',
  border: '1px solid rgba(255,255,255,0.12)',
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
      <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'rgba(255,255,255,0.30)' }}>
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
      <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'rgba(255,255,255,0.30)' }}>
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
      <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'rgba(255,255,255,0.30)' }}>
        No timeline data
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={revenueTimeline} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="onlineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#F43F5E" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="coinGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#FBBF24" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#FBBF24" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="rfidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#A78BFA" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#A78BFA" stopOpacity={0}    />
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
        <Area type="monotone" dataKey="online" name="Online" stroke="#F43F5E" fill="url(#onlineGrad)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="coin"   name="Coin"   stroke="#FBBF24" fill="url(#coinGrad)"   strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="rfid"   name="RFID"   stroke="#A78BFA" fill="url(#rfidGrad)"   strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MachineStatusBar({ online, offline, total }: { online: number; offline: number; total: number }) {
  const pct = total > 0 ? Math.round((online / total) * 100) : 0;
  const barColor = pct > 70 ? '#34D399' : pct > 40 ? '#FBBF24' : '#F43F5E';
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span style={{ color: 'rgba(255,255,255,0.50)' }}>{online} online · {offline} offline</span>
        <span className="font-semibold text-white">{pct}%</span>
      </div>
      <div className="w-full rounded-full h-2.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-2.5 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${barColor}cc, ${barColor})` }}
        />
      </div>
    </div>
  );
}
