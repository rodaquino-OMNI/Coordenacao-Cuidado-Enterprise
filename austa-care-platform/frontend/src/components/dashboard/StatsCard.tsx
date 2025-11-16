import React from 'react';
import { Activity, Bell, Heart, MessageCircle } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number;
  icon: 'message-circle' | 'activity' | 'heart' | 'bell';
  color: 'blue' | 'green' | 'red' | 'yellow';
}

const iconMap = {
  'message-circle': MessageCircle,
  'activity': Activity,
  'heart': Heart,
  'bell': Bell,
};

const colorMap = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  red: 'bg-red-100 text-red-600',
  yellow: 'bg-yellow-100 text-yellow-600',
};

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color }) => {
  const Icon = iconMap[icon];

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full ${colorMap[color]} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
