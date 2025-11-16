export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'PATIENT' | 'CAREGIVER' | 'HEALTHCARE_PROVIDER' | 'ADMIN';
  profilePictureUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'PATIENT' | 'CAREGIVER';
  dateOfBirth?: string;
  phoneNumber?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface HealthMetric {
  id: string;
  userId: string;
  type: 'BLOOD_PRESSURE' | 'HEART_RATE' | 'GLUCOSE' | 'WEIGHT' | 'TEMPERATURE' | 'OXYGEN_SATURATION';
  value: number;
  unit: string;
  timestamp: string;
  notes?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
  status: 'ACTIVE' | 'ARCHIVED';
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  sender: 'USER' | 'AI';
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalConversations: number;
  activeConversations: number;
  healthMetricsCount: number;
  unreadNotifications: number;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
  }>;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  lastLogin?: string;
  createdAt: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    api: 'up' | 'down';
  };
  uptime: number;
  version: string;
}
