'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface KpiPieChartProps {
  data: { name: string; value: number; color: string }[];
  title?: string;
  centerLabel?: string;
  centerValue?: string;
}

const RADIAN = Math.PI / 180;

export default function KpiPieChart({ data, title, centerLabel, centerValue }: KpiPieChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderCustomLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[11px] font-medium">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-6">
      {title && <h3 className="text-sm font-semibold text-gray-400 mb-4">{title}</h3>}
      <div className="relative" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              labelLine={false}
              label={renderCustomLabel}
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a2e',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '12px',
                fontSize: '13px',
                padding: '10px 14px',
              }}
              labelStyle={{ color: '#ffffff', fontWeight: 600, marginBottom: 4 }}
              itemStyle={{ color: '#d1d5db' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [`${Number(value).toFixed(1)}`, 'Score']}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerLabel && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{centerValue}</p>
              <p className="text-[11px] text-gray-500">{centerLabel}</p>
            </div>
          </div>
        )}
      </div>
      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-gray-400 truncate">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
