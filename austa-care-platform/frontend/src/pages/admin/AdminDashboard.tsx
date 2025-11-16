import React, { useState } from 'react';
import { Users, Activity, Shield, BarChart3 } from 'lucide-react';
import { UserManagement } from '@/components/admin/UserManagement';
import { SystemHealth } from '@/components/admin/SystemHealth';
import { Analytics } from '@/components/admin/Analytics';

type TabType = 'users' | 'health' | 'analytics' | 'permissions';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('users');

  const tabs = [
    { id: 'users' as TabType, label: 'User Management', icon: Users },
    { id: 'health' as TabType, label: 'System Health', icon: Activity },
    { id: 'analytics' as TabType, label: 'Analytics', icon: BarChart3 },
    { id: 'permissions' as TabType, label: 'Permissions', icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Manage users, monitor system health, and view analytics</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'health' && <SystemHealth />}
        {activeTab === 'analytics' && <Analytics />}
        {activeTab === 'permissions' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Permission Management</h2>
            <p className="text-gray-600">Permission management features coming soon...</p>
          </div>
        )}
      </main>
    </div>
  );
};
