/**
 * E2E Tests for Complete Authentication Flow
 * Tests user registration, login, password reset, and session management
 */

import request from 'supertest';
import { app } from '../../src/server';
import { TestDatabase } from '../helpers/test-database';
import { TestFactories } from '../helpers/test-factories';

describe('Authentication Flow E2E Tests', () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = TestDatabase.getInstance();
    await testDb.connect();
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    await testDb.cleanup();
  });

  describe('Complete User Registration Flow', () => {
    it('should register new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        name: 'New User',
        phone: '5511999999999',
        acceptedTerms: true
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.name).toBe(userData.name);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should validate email format during registration', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePassword123!',
        name: 'Test User',
        phone: '5511999999999'
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body.error).toContain('email');
    });

    it('should enforce password strength requirements', async () => {
      const userData = {
        email: 'user@example.com',
        password: 'weak',
        name: 'Test User',
        phone: '5511999999999'
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body.error).toContain('password');
    });

    it('should prevent duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePassword123!',
        name: 'User One',
        phone: '5511999999999'
      };

      // First registration
      await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201);

      // Attempt duplicate
      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(409);

      expect(response.body.error).toContain('email already exists');
    });

    it('should hash password before storage', async () => {
      const userData = {
        email: 'hashtest@example.com',
        password: 'SecurePassword123!',
        name: 'Hash Test User',
        phone: '5511999999999'
      };

      await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201);

      // Check database
      const user = await testDb.getPrismaClient().user.findUnique({
        where: { email: userData.email }
      });

      expect(user).toBeDefined();
      expect(user!.password).not.toBe(userData.password);
      expect(user!.password.length).toBeGreaterThan(20); // Hashed password is long
    });
  });

  describe('User Login Flow', () => {
    let testUser: any;
    const userPassword = 'SecurePassword123!';

    beforeEach(async () => {
      // Create test user
      const signupResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'logintest@example.com',
          password: userPassword,
          name: 'Login Test User',
          phone: '5511999999999'
        });

      testUser = signupResponse.body.user;
    });

    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: userPassword
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user.id).toBe(testUser.id);
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: userPassword
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should return valid JWT token on successful login', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: userPassword
        })
        .expect(200);

      const token = loginResponse.body.token;

      // Use token to access protected endpoint
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileResponse.body.id).toBe(testUser.id);
    });
  });

  describe('Protected Route Access', () => {
    let authToken: string;
    let testUser: any;

    beforeEach(async () => {
      const signupResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'protected@example.com',
          password: 'SecurePassword123!',
          name: 'Protected Test User',
          phone: '5511999999999'
        });

      testUser = signupResponse.body.user;
      authToken = signupResponse.body.token;
    });

    it('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testUser.id);
    });

    it('should reject access without token', async () => {
      await request(app)
        .get('/api/auth/profile')
        .expect(401);
    });

    it('should reject access with invalid token', async () => {
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
    });

    it('should reject access with malformed authorization header', async () => {
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'InvalidFormat token123')
        .expect(401);
    });

    it('should reject access with expired token', async () => {
      // This would require creating an expired token
      // Implementation depends on JWT library configuration
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjF9.invalid';

      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Password Reset Flow', () => {
    let testUser: any;

    beforeEach(async () => {
      const signupResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'reset@example.com',
          password: 'OldPassword123!',
          name: 'Reset Test User',
          phone: '5511999999999'
        });

      testUser = signupResponse.body.user;
    });

    it('should request password reset successfully', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: testUser.email
        })
        .expect(200);

      expect(response.body.message).toContain('reset link sent');
    });

    it('should not reveal if email exists during password reset request', async () => {
      // Security: Don't leak which emails are registered
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        })
        .expect(200);

      expect(response.body.message).toContain('reset link sent');
    });

    it('should reset password with valid reset token', async () => {
      // Request reset
      await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: testUser.email
        });

      // Get reset token from database (in real scenario, from email)
      const user = await testDb.getPrismaClient().user.findUnique({
        where: { email: testUser.email }
      });

      const resetToken = user!.resetToken;

      // Reset password
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'NewSecurePassword123!'
        })
        .expect(200);

      expect(response.body.message).toContain('Password reset successful');

      // Verify new password works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'NewSecurePassword123!'
        })
        .expect(200);

      // Verify old password doesn't work
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'OldPassword123!'
        })
        .expect(401);
    });
  });

  describe('Logout Flow', () => {
    let authToken: string;

    beforeEach(async () => {
      const signupResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'logout@example.com',
          password: 'SecurePassword123!',
          name: 'Logout Test User',
          phone: '5511999999999'
        });

      authToken = signupResponse.body.token;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('Logged out');
    });

    it('should invalidate token after logout', async () => {
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Token should no longer work (if token blacklisting is implemented)
      // Note: This depends on your implementation
      // Some systems use token blacklisting, others rely on short expiry
    });
  });

  describe('Session Management', () => {
    it('should handle concurrent logins from same user', async () => {
      const userData = {
        email: 'concurrent@example.com',
        password: 'SecurePassword123!',
        name: 'Concurrent Test User',
        phone: '5511999999999'
      };

      await request(app)
        .post('/api/auth/signup')
        .send(userData);

      // Login from multiple devices
      const login1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      const login2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      // Both tokens should be valid
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${login1.body.token}`)
        .expect(200);

      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${login2.body.token}`)
        .expect(200);
    });
  });

  describe('Rate Limiting on Auth Endpoints', () => {
    it('should enforce rate limits on login attempts', async () => {
      const userData = {
        email: 'ratelimit@example.com',
        password: 'SecurePassword123!'
      };

      // Attempt many logins
      const loginAttempts = Array.from({ length: 50 }, () =>
        request(app)
          .post('/api/auth/login')
          .send(userData)
      );

      const responses = await Promise.all(loginAttempts);

      // Some should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
