# AUSTA Care Platform - Frontend

A modern, responsive React + TypeScript web application for the AUSTA Care healthcare platform.

## Technology Stack

- **Framework**: React 18.2.0 + TypeScript 5.3.2
- **Build Tool**: Vite 5.0.6
- **Styling**: Tailwind CSS 3.3.6
- **State Management**: Zustand 4.4.7
- **Data Fetching**: @tanstack/react-query 5.8.4
- **HTTP Client**: Axios 1.6.2
- **Routing**: React Router DOM 6.20.1
- **Charts**: Recharts 2.8.0
- **UI Components**: Radix UI primitives
- **Notifications**: React Hot Toast 2.4.1
- **Animations**: Framer Motion 10.16.16
- **PWA**: Vite Plugin PWA 0.17.4

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── admin/          # Admin panel components
│   │   ├── charts/         # Data visualization components
│   │   ├── dashboard/      # Dashboard-specific components
│   │   ├── layout/         # Layout components (MainLayout, ProtectedRoute)
│   │   └── ui/             # Reusable UI components
│   ├── pages/
│   │   ├── auth/           # Authentication pages (Login, Register, ForgotPassword)
│   │   ├── dashboard/      # Dashboard page
│   │   └── admin/          # Admin panel pages
│   ├── services/
│   │   ├── api.ts          # Axios API client with interceptors
│   │   └── auth.service.ts # Authentication service
│   ├── store/
│   │   └── auth.store.ts   # Zustand authentication store
│   ├── types/
│   │   └── index.ts        # TypeScript type definitions
│   ├── utils/              # Utility functions
│   ├── styles/
│   │   └── index.css       # Global styles and Tailwind imports
│   ├── App.tsx             # Main app component with routing
│   ├── main.tsx            # Application entry point
│   └── vite-env.d.ts       # Vite environment types
├── public/                 # Static assets
├── dist/                   # Production build output (704KB)
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── .env                    # Environment variables
```

## Features Implemented

### 1. Authentication System
- **Login Page**: Email/password authentication with JWT token management
- **Registration Page**: User sign-up with role selection (Patient/Caregiver)
- **Password Recovery**: Forgot password flow with email reset
- **Protected Routes**: Route guards for authenticated access
- **Token Refresh**: Automatic JWT token refresh on 401 responses
- **Persistent Sessions**: Token storage in localStorage

### 2. Dashboard
- **Stats Cards**: Total conversations, active conversations, health metrics, notifications
- **Health Metrics Chart**: Line chart visualization using Recharts
- **Conversation List**: Recent conversations with status indicators
- **Notification Panel**: Real-time notifications with read/unread status
- **Recent Activity**: Timeline of user activities

### 3. Admin Panel
- **User Management**:
  - User list table with search functionality
  - User status management (Active/Inactive/Suspended)
  - Role-based filtering
  - Last login tracking
- **System Health**:
  - Service status monitoring (Database, Redis, API)
  - System uptime tracking
  - Version information
- **Analytics**:
  - User growth bar charts
  - Users by role pie charts
  - Conversation statistics
  - Key performance metrics

### 4. Responsive Design
- Mobile-first approach with Tailwind CSS
- Responsive grid layouts
- Adaptive sidebar navigation
- Touch-friendly UI components
- Progressive Web App (PWA) support

### 5. API Integration
- Centralized API service with Axios
- Automatic token injection via interceptors
- Token refresh handling
- Error handling and retry logic
- Type-safe API calls with TypeScript

## Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=AUSTA Care Platform
VITE_APP_VERSION=1.0.0
```

## Available Scripts

```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Run tests with UI
npm test:ui

# Run tests with coverage
npm test:coverage

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Type check
npm run type-check
```

## Development Workflow

1. **Start Backend**: Ensure the backend API is running on port 3000
2. **Start Frontend**: Run `npm run dev` to start the Vite dev server
3. **Access App**: Open http://localhost:5173 in your browser
4. **Login/Register**: Use the authentication pages to access the app

## Build Output

The production build creates optimized bundles:

- **Total Size**: ~704KB (gzipped)
- **Code Splitting**: Vendor, UI, and Charts chunks
- **PWA Support**: Service worker and manifest included
- **Assets**: Optimized CSS and JS with source maps

### Build Chunks:
- `vendor.js`: React, React Router (162KB / 53KB gzipped)
- `charts.js`: Recharts library (410KB / 110KB gzipped)
- `ui.js`: Radix UI components (0.96KB / 0.61KB gzipped)
- `index.js`: Application code (128KB / 39KB gzipped)
- `index.css`: Tailwind styles (18KB / 4KB gzipped)

## API Endpoints Used

The frontend connects to these backend endpoints:

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset
- `GET /api/auth/me` - Get current user

### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/health-metrics` - User health metrics
- `GET /api/conversations` - User conversations
- `GET /api/notifications` - User notifications
- `PATCH /api/notifications/:id/read` - Mark notification as read

### Admin
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/:id/status` - Update user status
- `GET /api/admin/health` - System health status
- `GET /api/admin/analytics` - Platform analytics

## UI Components

### Reusable Components
- **StatsCard**: Metric display cards with icons
- **ConversationList**: Conversation list with metadata
- **NotificationPanel**: Real-time notification feed
- **HealthMetricsChart**: Line chart for health data
- **UserManagement**: Admin user management table
- **SystemHealth**: Service status monitoring
- **Analytics**: Dashboard analytics charts

### Layout Components
- **MainLayout**: Main app layout with sidebar navigation
- **ProtectedRoute**: Route wrapper for authentication

## State Management

### Zustand Stores
- **authStore**:
  - User authentication state
  - Login/logout actions
  - Token management
  - Auth state persistence

## Styling

### Tailwind Configuration
- Custom color palette (primary, secondary)
- Responsive breakpoints
- Custom font family (Inter)
- Extended theme configuration

### CSS Features
- Custom scrollbar styles
- Loading animations
- Smooth transitions
- Line clamp utilities

## Performance Optimizations

1. **Code Splitting**: Vendor, UI, and Charts separated
2. **Lazy Loading**: Route-based code splitting ready
3. **React Query**: Efficient data fetching and caching
4. **PWA**: Offline support and caching
5. **Optimized Images**: Asset optimization ready
6. **Gzip Compression**: Production builds compressed

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Progressive Web App (PWA)

The app is PWA-ready with:
- Service Worker for offline support
- Web App Manifest
- Installable on mobile devices
- Offline fallback pages
- Background sync ready

## Security Features

- JWT token-based authentication
- HTTP-only cookie support ready
- XSS protection
- CSRF protection ready
- Secure token storage
- Automatic token refresh

## Future Enhancements

- [ ] Real-time chat interface
- [ ] Video consultation integration
- [ ] Advanced health metric tracking
- [ ] Document upload and management
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Accessibility improvements (WCAG 2.1)
- [ ] E2E testing with Playwright
- [ ] Storybook for component documentation

## Testing

Tests can be added using Vitest:

```bash
# Run tests
npm test

# Run with UI
npm test:ui

# Coverage report
npm test:coverage
```

## Troubleshooting

### Common Issues

1. **Build fails**: Clear node_modules and reinstall
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **API connection fails**: Check VITE_API_URL in .env

3. **TypeScript errors**: Run `npm run type-check`

4. **Styling issues**: Rebuild Tailwind
   ```bash
   npm run build
   ```

## Contributing

1. Follow the existing code structure
2. Use TypeScript for type safety
3. Follow the component naming conventions
4. Write meaningful commit messages
5. Test on multiple browsers
6. Ensure responsive design

## License

Proprietary - AUSTA Care Platform

## Support

For issues or questions, contact the development team.

---

**Status**: ✅ Build Successful | Production Ready
**Version**: 1.0.0
**Last Updated**: 2025-11-16
