# AUSTA Care Platform - Database Setup Guide

## Current Status

✅ **Completed:**
- Prisma schema validated and fixed
- Prisma Client generated successfully
- Environment file (.env) created from template
- Comprehensive seed script created

⏳ **Pending (Requires Docker):**
- PostgreSQL database startup
- Database migrations
- Database seeding

## Prerequisites

### 1. Docker Desktop
The AUSTA platform uses Docker for infrastructure services (PostgreSQL, Redis, etc.).

**Install Docker Desktop:**
- Download from: https://www.docker.com/products/docker-desktop
- Install and start Docker Desktop
- Verify installation: `docker --version`

### 2. Environment Variables
A `.env` file has been created with default values. Update the following if needed:

```bash
# Database connection (default works with Docker)
DATABASE_URL="postgresql://austa_user:secure_password@localhost:5432/austa_care_platform?schema=public"

# JWT and encryption keys (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=your-super-secure-jwt-secret-key-here
ENCRYPTION_KEY=your-32-character-encryption-key-here

# WhatsApp Business API (configure when ready)
WHATSAPP_BUSINESS_ID=your-whatsapp-business-id
WHATSAPP_ACCESS_TOKEN=your-whatsapp-access-token

# OpenAI API (configure when ready)
OPENAI_API_KEY=your-openai-api-key
```

## Database Initialization Steps

Once Docker is installed and running, follow these steps:

### Step 1: Start PostgreSQL
```bash
# From project root directory
cd /Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform

# Start PostgreSQL container
docker-compose -f docker-compose.infrastructure.yml up -d postgres

# Verify PostgreSQL is running
docker ps | grep postgres
```

### Step 2: Run Migrations
```bash
# Generate Prisma Client (already done, but can be re-run)
npx prisma generate

# Run database migrations to create tables
npx prisma migrate dev --name init

# This will:
# - Create all database tables
# - Apply indexes and constraints
# - Set up foreign key relationships
```

### Step 3: Seed Database
```bash
# Execute the seed script
npm run db:seed

# This will populate the database with:
# - 3 Organizations (Hospital, Clinic, Laboratory)
# - 4 Healthcare Providers
# - 4 Patient Users
# - Health data records
# - 5 Gamification missions
# - Authorization templates
# - Sample conversations and messages
# - Audit logs
```

### Step 4: Verify Setup
```bash
# Connect to database via Prisma Studio
npx prisma studio

# Or connect via psql
docker exec -it postgres psql -U austa_user -d austa_care_platform

# Check tables
\dt

# Check sample data
SELECT * FROM organizations;
SELECT * FROM users LIMIT 5;
```

## Database Schema Summary

The AUSTA platform schema includes:

### Core Models
- **Organization**: Healthcare facilities (hospitals, clinics, labs)
- **User**: Patients with WhatsApp integration
- **Provider**: Healthcare professionals (doctors, nurses, admins)

### Health Data Models
- **HealthData**: Medical records, conditions, medications, allergies
- **Authorization**: Procedure and medication authorizations
- **Document**: Medical documents with OCR capability

### Communication Models
- **Conversation**: WhatsApp conversation threads
- **Message**: Individual WhatsApp messages with AI processing

### Gamification Models
- **Mission**: Gamification missions and challenges
- **OnboardingProgress**: User progress tracking
- **HealthPoints**: Points and rewards system
- **PointTransaction**: Point transaction history

### Integration Models
- **TasyIntegration**: Tasy ERP integration configuration
- **TasySyncLog**: Synchronization logs
- **AuditLog**: HIPAA/LGPD compliance audit trail

## Seed Data Overview

The seed script creates realistic Brazilian healthcare data:

### Organizations
1. **Hospital São Paulo** (Main hospital)
2. **Clínica Saúde e Vida** (Clinic)
3. **Laboratório Diagnóstico Total** (Laboratory)

### Sample Patients
1. **João Silva** - Hypertension patient (Level 2, 350 points)
2. **Maria Santos** - Diabetes patient (Level 1, 100 points)
3. **Pedro Oliveira** - Clinic patient
4. **Ana Costa** - New unverified patient

### Healthcare Providers
1. **Dr. Carlos Silva** - Cardiologist (CRM-SP 123456)
2. **Dra. Ana Santos** - Pediatrician (CRM-SP 654321)
3. **Enf. Maria Oliveira** - Nurse (COREN-SP 789012)
4. **Admin Sistema** - System Administrator

### Gamification Missions
1. Welcome to AUSTA (100 points)
2. First Appointment (150 points)
3. Share Your Medications (200 points)
4. Regular Physical Activity (500 points)
5. Preventive Exams (300 points)

## Troubleshooting

### Issue: Docker not running
**Error:** `Cannot connect to the Docker daemon`

**Solution:**
1. Install Docker Desktop
2. Start Docker Desktop application
3. Wait for Docker to fully start (whale icon in system tray)
4. Retry database setup commands

### Issue: Port 5432 already in use
**Error:** `port is already allocated`

**Solution:**
```bash
# Check what's using port 5432
lsof -i :5432

# Stop existing PostgreSQL
# If using Homebrew PostgreSQL:
brew services stop postgresql

# If using another Docker container:
docker stop $(docker ps -q --filter "publish=5432")
```

### Issue: Migration fails
**Error:** `P1012` or schema validation errors

**Solution:**
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Or manually drop and recreate
docker exec -it postgres psql -U postgres -c "DROP DATABASE austa_care_platform;"
docker exec -it postgres psql -U postgres -c "CREATE DATABASE austa_care_platform OWNER austa_user;"
```

### Issue: Seed script fails
**Error:** Unique constraint violations

**Solution:**
```bash
# The seed script cleans data in development mode
# Ensure NODE_ENV is set to development
export NODE_ENV=development

# Re-run seed script
npm run db:seed
```

## Security Notes

### Production Checklist
Before deploying to production:

1. **Change all default credentials:**
   - Database passwords
   - JWT secrets
   - Encryption keys
   - API tokens

2. **Enable SSL/TLS:**
   - Database connections
   - API endpoints
   - WhatsApp webhooks

3. **Configure backups:**
   - Daily automated backups
   - Retention policy (7 years for HIPAA)
   - Disaster recovery plan

4. **Enable audit logging:**
   - All data access
   - PHI modifications
   - Authorization changes

5. **Data encryption:**
   - Encryption at rest (database)
   - Encryption in transit (TLS)
   - Field-level encryption for PII/PHI

## Next Steps

After database initialization:

1. **Start backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Run tests:**
   ```bash
   npm run test
   ```

3. **Configure WhatsApp Business API:**
   - Set up WhatsApp Business account
   - Update WHATSAPP_* environment variables
   - Configure webhook endpoints

4. **Configure Tasy ERP integration:**
   - Obtain Tasy API credentials
   - Update TASY_* environment variables
   - Test synchronization

5. **Deploy infrastructure:**
   ```bash
   docker-compose -f docker-compose.infrastructure.yml up -d
   ```

## Support

For issues or questions:
- Check logs: `docker-compose logs postgres`
- Review Prisma docs: https://www.prisma.io/docs
- Database schema: `prisma/schema.prisma`
- Seed script: `backend/src/database/seed.ts`

---

**AUSTA Care Platform** - Healthcare coordination made simple with WhatsApp integration
