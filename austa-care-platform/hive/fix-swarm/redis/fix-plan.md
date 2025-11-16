# Redis Fix Implementation Plan

## Problem Summary

**Current Behavior:**
- Server crashes when Redis is unavailable (ECONNREFUSED on port 6379)
- Blocking connection in `redis.cluster.ts` lines 31-44, 106-109
- Uses `ioredis` library correctly, but lacks graceful degradation

**Root Causes:**
1. `connect()` method throws error when Redis unavailable (line 43)
2. `connectStandalone()` waits for connection with Promise that rejects (lines 106-109)
3. Server initialization blocks on Redis connection (server.ts line 165)

## Fix Strategy

### 1. Modify `redis.cluster.ts`
- Add `isAvailable` flag to track Redis availability
- Make `connect()` non-blocking - catch errors and set `isAvailable = false`
- Wrap all operations with availability checks
- Log warnings instead of throwing errors

### 2. Modify `server.ts`
- Make Redis connection non-blocking in `initializeServices()`
- Allow server to start even if Redis fails
- Log degraded mode warnings

### 3. Add Graceful Fallbacks
- All Redis operations return null/void when unavailable
- No caching = direct database queries (slower but functional)
- Session management falls back to JWT-only

## Implementation Steps

1. Update `redis.cluster.ts` with graceful degradation
2. Update `server.ts` to make Redis optional
3. Test server startup without Redis
4. Verify all endpoints work (albeit slower without caching)
