import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { apiService } from '@/services/api';
import type { DashboardStats, HealthMetric, Conversation } from '@/types';
import { HealthMetricsChart } from '@/components/charts/HealthMetricsChart';
import { ConversationList } from '@/components/dashboard/ConversationList';
import { NotificationPanel } from '@/components/dashboard/NotificationPanel';
import { StatsCard } from '@/components/dashboard/StatsCard';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const [statsData, metricsData, conversationsData] = await Promise.all([
        apiService.get<DashboardStats>('/api/dashboard/stats'),
        apiService.get<HealthMetric[]>('/api/health-metrics'),
        apiService.get<Conversation[]>('/api/conversations'),
      ]);

      setStats(statsData);
      setHealthMetrics(metricsData);
      setConversations(conversationsData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {user?.firstName}!
              </h1>
              <p className="text-gray-600">Here's your health overview</p>
            </div>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
              New Conversation
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Conversations"
            value={stats?.totalConversations || 0}
            icon="message-circle"
            color="blue"
          />
          <StatsCard
            title="Active Conversations"
            value={stats?.activeConversations || 0}
            icon="activity"
            color="green"
          />
          <StatsCard
            title="Health Metrics"
            value={stats?.healthMetricsCount || 0}
            icon="heart"
            color="red"
          />
          <StatsCard
            title="Notifications"
            value={stats?.unreadNotifications || 0}
            icon="bell"
            color="yellow"
          />
        </div>

        {/* Charts and Lists Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Health Metrics Chart */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Health Metrics Overview
              </h2>
              <HealthMetricsChart metrics={healthMetrics} />
            </div>
          </div>

          {/* Notifications Panel */}
          <div className="lg:col-span-1">
            <NotificationPanel />
          </div>
        </div>

        {/* Conversation History */}
        <div className="mt-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Conversations
            </h2>
            <ConversationList conversations={conversations} />
          </div>
        </div>

        {/* Recent Activity */}
        {stats?.recentActivity && stats.recentActivity.length > 0 && (
          <div className="mt-8">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Recent Activity
              </h2>
              <div className="space-y-4">
                {stats.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition"
                  >
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
