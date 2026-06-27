/**
 * lib/crypto.ts — PGCrypto Envelope Encryption for PHI/PII
 *
 * AUSTA Care Platform — healthcare brasileira (LGPD/ANS compliance).
 *
 * Uses PostgreSQL pgcrypto extension (pgp_sym_encrypt / pgp_sym_decrypt)
 * for column-level encryption of Protected Health Information (PHI) and
 * Personally Identifiable Information (PII).
 *
 * Architecture:
 *   - Tenant-level encryption key fetched per organizationId.
 *   - In production: AWS Secrets Manager / HashiCorp Vault.
 *   - Development: environment variable with org-scoped fallback.
 *   - Encrypted data stored as base64-encoded strings.
 *
 * Key Rotation:
 *   - TODO: Implement key versioning (key_id column in encrypted tables).
 *   - TODO: Re-encrypt on key rotation via background job.
 */

import { prisma } from '../config/database';

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

/**
 * Get the static encryption key from environment.
 * Used as fallback when tenant-specific keys are not configured.
 *
 * Production: AWS KMS / HashiCorp Vault
 * Development: AUDIT_ENCRYPTION_KEY env variable
 */
function getEncryptionKey(): string {
  const key = process.env.AUDIT_ENCRYPTION_KEY
    || process.env.ENCRYPTION_KEY
    || process.env.PGCRYPTO_KEY
    || 'austa-dev-default-key';
  if (!key && process.env.NODE_ENV === 'production') {
    throw new Error('AUDIT_ENCRYPTION_KEY not set in production');
  }
  return key;
}

// ---------------------------------------------------------------------------
// Tenant key resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the symmetric encryption key for a given tenant (organization).
 *
 * Production path (to be implemented):
 *   - AWS Secrets Manager: `austa/encryption/${organizationId}`
 *   - HashiCorp Vault:     `transit/keys/${organizationId}`
 *
 * @param organizationId - Tenant identifier
 * @returns 32-byte encryption passphrase
 */
async function getTenantKey(organizationId: string): Promise<string> {
  // ------------------------------------------------------------------
  // TODO (production): fetch from AWS Secrets Manager / Vault
  //   import { SecretsManager } from '@aws-sdk/client-secrets-manager';
  //   const secret = await secretsManager.getSecretValue({
  //     SecretId: `austa/encryption/${organizationId}`
  //   });
  //   return secret.SecretString;
  // ------------------------------------------------------------------
  return getEncryptionKey();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypt plaintext PHI/PII using pgcrypto symmetric encryption.
 *
 * @param organizationId - Tenant that owns the data
 * @param plaintext       - Sensitive value to encrypt
 * @returns Base64-encoded ciphertext (safe for VARCHAR/TEXT columns)
 */
export async function encryptPHI(
  organizationId: string,
  plaintext: string
): Promise<string> {
  const key = await getTenantKey(organizationId);

  const result = await prisma.$queryRawUnsafe<{ encrypted: string }[]>(
    `SELECT encode(pgp_sym_encrypt($1, $2), 'base64') as encrypted`,
    plaintext,
    key
  );

  return result[0].encrypted;
}

/**
 * Decrypt ciphertext previously encrypted with encryptPHI.
 *
 * @param organizationId - Tenant that owns the data
 * @param ciphertext      - Base64-encoded ciphertext
 * @returns Original plaintext
 */
export async function decryptPHI(
  organizationId: string,
  ciphertext: string
): Promise<string> {
  const key = await getTenantKey(organizationId);

  const result = await prisma.$queryRawUnsafe<{ decrypted: string }[]>(
    `SELECT pgp_sym_decrypt(decode($1, 'base64'), $2) as decrypted`,
    ciphertext,
    key
  );

  return result[0].decrypted;
}

// ---------------------------------------------------------------------------
// Key rotation placeholder
// ---------------------------------------------------------------------------

/**
 * TODO: Key Rotation
 *
 * When encryption keys are rotated:
 *   1. Store `key_version` in each encrypted record.
 *   2. Fetch old key by version, decrypt, re-encrypt with new key.
 *   3. Run as a background job (BullMQ / cron) with rate limiting.
 *
 * Example:
 *   ALTER TABLE users ADD COLUMN key_version INTEGER DEFAULT 1;
 *
 *   async function rotateKeys(
 *     oldKeyVersion: number,
 *     newOrganizationId: string
 *   ): Promise<void> { ... }
 */
