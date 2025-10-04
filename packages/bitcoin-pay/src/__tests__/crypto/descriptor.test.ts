import { describe, it, expect } from "vitest";
import { parseDescriptor, deriveAddress, createBIP21URI } from "../../crypto/descriptor.js";

describe("descriptor", () => {
	describe("parseDescriptor", () => {
		it("should parse P2WPKH descriptor", () => {
			const descriptor = "wpkh([fingerprint/84'/0'/0']xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz/0/*)";
			const parsed = parseDescriptor(descriptor, "mainnet");

			expect(parsed.type).toBe("wpkh");
			expect(parsed.xpub).toBe("xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz");
			expect(parsed.derivationPath).toBe("0/*");
		});

		it("should parse P2TR descriptor", () => {
			const descriptor = "tr([fingerprint/86'/0'/0']xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ/0/*)";
			const parsed = parseDescriptor(descriptor, "mainnet");

			expect(parsed.type).toBe("tr");
			expect(parsed.xpub).toBe("xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ");
		});

		it("should throw on invalid descriptor", () => {
			expect(() => parseDescriptor("invalid", "mainnet")).toThrow();
		});
	});

	describe("deriveAddress", () => {
		it("should derive P2WPKH address", () => {
			const descriptor = "wpkh([fingerprint/84'/0'/0']xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz/0/*)";
			const parsed = parseDescriptor(descriptor, "mainnet");

			const { address, scriptPubKey } = deriveAddress(parsed, 0);

			expect(address).toBeTruthy();
			expect(address).toMatch(/^bc1/); // Bech32 address
			expect(scriptPubKey).toBeTruthy();
			expect(Buffer.isBuffer(scriptPubKey)).toBe(true);
		});

		it("should derive different addresses for different indices", () => {
			const descriptor = "wpkh([fingerprint/84'/0'/0']xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz/0/*)";
			const parsed = parseDescriptor(descriptor, "mainnet");

			const addr0 = deriveAddress(parsed, 0);
			const addr1 = deriveAddress(parsed, 1);

			expect(addr0.address).not.toBe(addr1.address);
			expect(addr0.scriptPubKey.toString("hex")).not.toBe(addr1.scriptPubKey.toString("hex"));
		});
	});

	describe("createBIP21URI", () => {
		it("should create basic BIP21 URI", () => {
			const uri = createBIP21URI("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", 100000);

			expect(uri).toContain("bitcoin:bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh");
			expect(uri).toContain("amount=0.00100000");
		});

		it("should include label if provided", () => {
			const uri = createBIP21URI(
				"bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
				100000,
				"Test Payment",
			);

			expect(uri).toContain("label=");
		});

		it("should handle large amounts correctly", () => {
			const uri = createBIP21URI("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", 21000000 * 100000000);

			expect(uri).toContain("amount=21000000.00000000");
		});
	});
});
