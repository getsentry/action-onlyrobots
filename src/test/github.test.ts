import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature } from '../github';

describe('GitHub utilities', () => {
  describe('verifyWebhookSignature', () => {
    it('should verify a valid webhook signature', async () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret';

      // Generate expected signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
      const signature = `sha256=${Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`;

      const isValid = await verifyWebhookSignature(payload, signature, secret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', async () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret';
      const wrongSignature = 'sha256=invalid';

      const isValid = await verifyWebhookSignature(payload, wrongSignature, secret);
      expect(isValid).toBe(false);
    });

    it('should reject missing signature', async () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret';

      const isValid = await verifyWebhookSignature(payload, null, secret);
      expect(isValid).toBe(false);
    });
  });
});
