import { describe, it, expect } from "vitest";
import { createMagicLinkToken, verifyMagicLinkToken } from "../../crypto/magic-link.js";

describe("magic-link", () => {
	const secret = "test-secret-key-123";
	const intentId = "intent_abc123";
	const nonce = "nonce_xyz789";

	it("should create and verify a valid token", () => {
		const token = createMagicLinkToken(
			{ intentId, nonce },
			secret,
			3600, // 1 hour
		);

		expect(token).toBeTruthy();
		expect(typeof token).toBe("string");
		expect(token).toContain(".");

		const payload = verifyMagicLinkToken(token, secret);
		expect(payload).toBeTruthy();
		expect(payload?.intentId).toBe(intentId);
		expect(payload?.nonce).toBe(nonce);
		expect(payload?.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
		expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
	});

	it("should reject token with wrong secret", () => {
		const token = createMagicLinkToken(
			{ intentId, nonce },
			secret,
			3600,
		);

		const payload = verifyMagicLinkToken(token, "wrong-secret");
		expect(payload).toBeNull();
	});

	it("should reject expired token", () => {
		const token = createMagicLinkToken(
			{ intentId, nonce },
			secret,
			-1, // Already expired
		);

		const payload = verifyMagicLinkToken(token, secret);
		expect(payload).toBeNull();
	});

	it("should reject malformed token", () => {
		const payload = verifyMagicLinkToken("invalid.token", secret);
		expect(payload).toBeNull();
	});

	it("should reject token with missing parts", () => {
		const payload = verifyMagicLinkToken("onlyonepart", secret);
		expect(payload).toBeNull();
	});
});
