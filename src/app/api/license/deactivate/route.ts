import { NextResponse } from "next/server";

import {
  deactivateLemonSqueezyLicense,
  readLemonSqueezyError,
  readLemonSqueezyLicenseDetails,
} from "@/lib/lemonsqueezyLicense";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | {
        licenseKey?: string;
        instanceId?: string;
      }
    | null;

  const licenseKey =
    typeof payload?.licenseKey === "string" ? payload.licenseKey.trim() : "";
  const instanceId =
    typeof payload?.instanceId === "string" ? payload.instanceId.trim() : "";

  if (!licenseKey || !instanceId) {
    return NextResponse.json(
      {
        deactivated: false,
        error: "License key and instance ID are required.",
        details: null,
      },
      { status: 400 }
    );
  }

  try {
    const result = await deactivateLemonSqueezyLicense(licenseKey, instanceId);
    const deactivated =
      result.response.ok && result.payload?.deactivated === true;
    return NextResponse.json(
      {
        deactivated,
        error: readLemonSqueezyError(result.payload),
        details: readLemonSqueezyLicenseDetails(result.payload),
      },
      { status: result.response.ok ? 200 : result.response.status || 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        deactivated: false,
        error: error instanceof Error ? error.message : "License deactivation failed.",
        details: null,
      },
      { status: 500 }
    );
  }
}
