import { NextResponse } from "next/server";

import {
  activateLemonSqueezyLicense,
  readLemonSqueezyError,
  readLemonSqueezyInstanceId,
  readLemonSqueezyLicenseValidity,
  validateLemonSqueezyLicense,
} from "@/lib/lemonsqueezyLicense";

const buildInstanceName = (value: unknown) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || "HT Alchemy";
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | {
        licenseKey?: string;
        instanceId?: string | null;
        instanceName?: string | null;
        activate?: boolean;
      }
    | null;

  const licenseKey =
    typeof payload?.licenseKey === "string" ? payload.licenseKey.trim() : "";
  const instanceId =
    typeof payload?.instanceId === "string" ? payload.instanceId.trim() : "";
  const shouldActivate = payload?.activate !== false;

  if (!licenseKey) {
    return NextResponse.json({ valid: false, error: "License key is required." }, { status: 400 });
  }

  try {
    const validation = await validateLemonSqueezyLicense(
      licenseKey,
      instanceId || undefined
    );
    const validationValid = readLemonSqueezyLicenseValidity(validation.payload);
    if (instanceId) {
      return NextResponse.json({
        valid: validation.response.ok && validationValid,
        error: readLemonSqueezyError(validation.payload),
        instanceId: validationValid ? instanceId : null,
      });
    }

    if (!validation.response.ok || !validationValid) {
      return NextResponse.json(
        {
          valid: false,
          error: readLemonSqueezyError(validation.payload),
          instanceId: null,
        },
        { status: validation.response.status || 400 }
      );
    }

    if (!shouldActivate) {
      return NextResponse.json({
        valid: true,
        error: null,
        instanceId: null,
      });
    }

    const activation = await activateLemonSqueezyLicense(
      licenseKey,
      buildInstanceName(payload?.instanceName)
    );
    const activated = readLemonSqueezyLicenseValidity(activation.payload);
    return NextResponse.json(
      {
        valid: activation.response.ok && activated,
        error: readLemonSqueezyError(activation.payload),
        instanceId: activated ? readLemonSqueezyInstanceId(activation.payload) : null,
      },
      { status: activation.response.ok ? 200 : activation.response.status || 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : "License validation failed.",
        instanceId: null,
      },
      { status: 500 }
    );
  }
}
