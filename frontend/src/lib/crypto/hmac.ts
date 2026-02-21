import crypto from "node:crypto";

export function hmacSha256Hex(secret: string, payload: string): string {
	return crypto
		.createHmac("sha256", secret)
		.update(payload, "utf8")
		.digest("hex");
}

export function sha256Hex(payload: string): string {
	return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

export function parseSignatureHeader(
	signatureHeader: string | null,
): string | null {
	if (!signatureHeader) return null;
	const match = signatureHeader.match(/^v1=([a-fA-F0-9]{64})$/);
	return match?.[1]?.toLowerCase() ?? null;
}

export function timingSafeEqualHex(aHex: string, bHex: string): boolean {
	try {
		const a = Buffer.from(aHex, "hex");
		const b = Buffer.from(bHex, "hex");
		if (a.length !== b.length) return false;
		return crypto.timingSafeEqual(a, b);
	} catch {
		return false;
	}
}

export function timingSafeEqualString(a: string, b: string): boolean {
	const aBuf = Buffer.from(a, "utf8");
	const bBuf = Buffer.from(b, "utf8");
	if (aBuf.length !== bBuf.length) return false;
	return crypto.timingSafeEqual(aBuf, bBuf);
}

export function parseTimestampToMs(input: string): number | null {
	if (/^\d+$/.test(input)) {
		const asNum = Number(input);
		if (!Number.isFinite(asNum)) return null;
		if (input.length <= 10) return asNum * 1000;
		return asNum;
	}

	const parsed = Date.parse(input);
	if (Number.isNaN(parsed)) return null;
	return parsed;
}
