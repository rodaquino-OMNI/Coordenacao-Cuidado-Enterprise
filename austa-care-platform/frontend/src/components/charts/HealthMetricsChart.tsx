import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { HealthMetric } from '@/types';

interface HealthMetricsChartProps {
  metrics: HealthMetric[];
}

export const HealthMetricsChart: React.FC<HealthMetricsChartProps> = ({ metrics }) => {
  // Group metrics by type and format for chart
  const chartData = React.useMemo(() => {
    const grouped = metrics.reduce((acc, metric) => {
      const date = new Date(metric.timestamp).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = { date };
      }
      acc[date][metric.type] = metric.value;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [metrics]);

  const metricTypes = React.useMemo(() => {
    return Array.from(new Set(metrics.map(m => m.type)));
  }, [metrics]);

  const colors = {
    BLOOD_PRESSURE: '#3b82f6',
    HEART_RATE: '#ef4444',
    GLUCOSE: '#10b981',
    WEIGHT: '#f59e0b',
    TEMPERATURE: '#8b5cf6',
    OXYGEN_SATURATION: '#06b6d4',
  };

  if (metrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No health metrics data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        {metricTypes.map((type) => (
          <Line
            key={type}
            type="monotone"
            dataKey={type}
            stroke={colors[type as keyof typeof colors]}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};
