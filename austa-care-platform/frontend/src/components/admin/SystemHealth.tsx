import React, { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import type { SystemHealth as SystemHealthType } from '@/types';
import { Activity, Database, Server, HardDrive, CheckCircle, XCircle } from 'lucide-react';

export const SystemHealth: React.FC = () => {
  const [health, setHealth] = useState<SystemHealthType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSystemHealth();
    const interval = setInterval(loadSystemHealth, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadSystemHealth = async () => {
    try {
      const data = await apiService.get<SystemHealthType>('/api/admin/health');
      setHealth(data);
    } catch (error) {
      console.error('Failed to load system health:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <p className="text-gray-600">Failed to load system health data.</p>
      </div>
    );
  }

  const statusColor = {
    healthy: 'bg-green-100 text-green-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    down: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
          <span
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              statusColor[health.status]
            }`}
          >
            {health.status.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center space-x-3">
            <Activity className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Version</p>
              <p className="text-lg font-semibold">{health.version}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Server className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Uptime</p>
              <p className="text-lg font-semibold">{formatUptime(health.uptime)}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <HardDrive className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">Services</p>
              <p className="text-lg font-semibold">
                {Object.values(health.services).filter(s => s === 'up').length}/
                {Object.keys(health.services).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Service Status */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Health</h2>
        <div className="space-y-4">
          {Object.entries(health.services).map(([service, status]) => (
            <div
              key={service}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                {service === 'database' ? (
                  <Database className="w-6 h-6 text-gray-600" />
                ) : service === 'redis' ? (
                  <HardDrive className="w-6 h-6 text-gray-600" />
                ) : (
                  <Server className="w-6 h-6 text-gray-600" />
                )}
                <span className="font-medium text-gray-900 capitalize">{service}</span>
              </div>
              <div className="flex items-center space-x-2">
                {status === 'up' ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-600 font-medium">Running</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-600 font-medium">Down</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
