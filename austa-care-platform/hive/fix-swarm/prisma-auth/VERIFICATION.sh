#!/bin/bash
# Verification Script for Prisma Auth Fix
# Run this to verify all changes are in place

echo "==================================="
echo "PRISMA AUTH FIX VERIFICATION"
echo "==================================="
echo ""

# Check 1: Prisma Schema
echo "✓ Checking Prisma schema for auth fields..."
if grep -q "password.*String" /Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/prisma/schema.prisma && \
   grep -q "resetToken.*String" /Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/prisma/schema.prisma && \
   grep -q "refreshToken.*String" /Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/prisma/schema.prisma && \
   grep -q "lastLoginAt.*DateTime" /Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/prisma/schema.prisma; then
    echo "  ✅ All auth fields present in schema"
else
    echo "  ❌ Missing auth fields in schema"
fi
echo ""

# Check 2: Auth Controller Implementation
echo "✓ Checking auth controller implementation..."
if grep -q "import.*bcrypt" /Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/backend/src/controllers/auth.ts && \
   grep -q "import.*jsonwebtoken" /Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/backend/src/controllers/auth.ts && \
   grep -q "PrismaClient" /Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/backend/src/controllers/auth.ts; then
    echo "  ✅ Auth controller has bcrypt, JWT, and Prisma"
else
    echo "  ❌ Auth controller missing dependencies"
fi
echo ""

# Check 3: Dependencies
echo "✓ Checking npm dependencies..."
cd /Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/backend
if npm list bcrypt 2>&1 | grep -q "bcrypt@" && \
   npm list jsonwebtoken 2>&1 | grep -q "jsonwebtoken@"; then
    echo "  ✅ bcrypt and jsonwebtoken installed"
else
    echo "  ❌ Missing required dependencies"
fi
echo ""

# Check 4: Prisma Client Generation
echo "✓ Checking Prisma client generation..."
if [ -f "/Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/node_modules/@prisma/client/index.js" ]; then
    echo "  ✅ Prisma client generated"
else
    echo "  ❌ Prisma client not generated"
fi
echo ""

# Check 5: Documentation
echo "✓ Checking documentation..."
if [ -f "/Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/hive/fix-swarm/prisma-auth/SCHEMA_FIX_REPORT.md" ] && \
   [ -f "/Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/hive/fix-swarm/prisma-auth/AUTH_ENDPOINTS_FIX_REPORT.md" ] && \
   [ -f "/Users/rodrigo/Documents/GitHub/Coordenacao-Cuidado-Enterprise/austa-care-platform/hive/fix-swarm/prisma-auth/EXECUTIVE_SUMMARY.md" ]; then
    echo "  ✅ All documentation files present"
else
    echo "  ❌ Missing documentation files"
fi
echo ""

echo "==================================="
echo "VERIFICATION COMPLETE"
echo "==================================="
echo ""
echo "Next Steps:"
echo "1. Set JWT_SECRET in .env file"
echo "2. Run: npx prisma migrate dev"
echo "3. Update unit tests to mock Prisma"
echo "4. Deploy to staging for testing"
