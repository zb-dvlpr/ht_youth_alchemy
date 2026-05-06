import { createHash } from "node:crypto";

const PREMIUM_LICENSE_HASHES_ENV = "HT_ALCHEMY_PREMIUM_LICENSE_HASHES";

const normalizeHash = (value: string) => value.trim().toLowerCase();

const readAllowedLicenseHashes = () =>
  (process.env[PREMIUM_LICENSE_HASHES_ENV] ?? "")
    .split(/[,\s]+/)
    .map(normalizeHash)
    .filter((value) => /^[a-f0-9]{64}$/.test(value));

const hashLicenseKey = (licenseKey: string) =>
  createHash("sha256").update(licenseKey).digest("hex");

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | {
        licenseKey?: string;
      }
    | null;
  const licenseKey =
    typeof payload?.licenseKey === "string" ? payload.licenseKey.trim() : "";
  if (!licenseKey) {
    return Response.json({ valid: false }, { status: 400 });
  }
  const allowedHashes = readAllowedLicenseHashes();
  const valid = allowedHashes.includes(hashLicenseKey(licenseKey));
  return Response.json({ valid });
}
