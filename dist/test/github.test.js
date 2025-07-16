"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const github_1 = require("../github");
(0, vitest_1.describe)('GitHub utilities', () => {
    (0, vitest_1.describe)('verifyWebhookSignature', () => {
        (0, vitest_1.it)('should verify a valid webhook signature', async () => {
            const payload = '{"test": "data"}';
            const secret = 'test-secret';
            // Generate expected signature
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
            const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
            const signature = `sha256=${Array.from(new Uint8Array(signatureBuffer))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('')}`;
            const isValid = await (0, github_1.verifyWebhookSignature)(payload, signature, secret);
            (0, vitest_1.expect)(isValid).toBe(true);
        });
        (0, vitest_1.it)('should reject invalid webhook signature', async () => {
            const payload = '{"test": "data"}';
            const secret = 'test-secret';
            const wrongSignature = 'sha256=invalid';
            const isValid = await (0, github_1.verifyWebhookSignature)(payload, wrongSignature, secret);
            (0, vitest_1.expect)(isValid).toBe(false);
        });
        (0, vitest_1.it)('should reject missing signature', async () => {
            const payload = '{"test": "data"}';
            const secret = 'test-secret';
            const isValid = await (0, github_1.verifyWebhookSignature)(payload, null, secret);
            (0, vitest_1.expect)(isValid).toBe(false);
        });
    });
});
//# sourceMappingURL=github.test.js.map