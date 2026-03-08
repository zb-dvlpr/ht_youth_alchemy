import { NextResponse } from "next/server";
import {
  assertChppPermissions,
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  ChppPermissionError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const TRAINING_VERSION = "2.2";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const actionType = url.searchParams.get("actionType") ?? "view";
    const teamId = url.searchParams.get("teamId");

    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "training",
      version: TRAINING_VERSION,
      actionType,
    });
    if (teamId) {
      params.set("teamId", teamId);
    }

    const { parsed, rawXml } = await fetchChppXml(auth, params);
    return NextResponse.json({ data: parsed, raw: rawXml });
  } catch (error) {
    if (error instanceof ChppAuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    const payload = buildChppErrorPayload("Failed to fetch training", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          teamId?: unknown;
          trainingType?: unknown;
          trainingLevel?: unknown;
          trainingLevelStamina?: unknown;
        }
      | null;

    const parsePositiveInteger = (value: unknown) => {
      if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isInteger(parsed) && parsed > 0) return parsed;
      }
      return null;
    };
    const parseOptionalInteger = (value: unknown) => {
      if (value === null || value === undefined || value === "") return null;
      if (typeof value === "number" && Number.isInteger(value)) return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isInteger(parsed)) return parsed;
      }
      return null;
    };

    const teamId = parsePositiveInteger(body?.teamId);
    const trainingType = parseOptionalInteger(body?.trainingType);
    const trainingLevel = parseOptionalInteger(body?.trainingLevel);
    const trainingLevelStamina = parseOptionalInteger(body?.trainingLevelStamina);

    if (!teamId) {
      return NextResponse.json(
        { error: "teamId is required for actionType=setTraining" },
        { status: 400 }
      );
    }
    if (trainingType === null) {
      return NextResponse.json(
        { error: "trainingType is required for actionType=setTraining" },
        { status: 400 }
      );
    }

    const auth = await getChppAuth();
    await assertChppPermissions(auth, ["set_training"]);

    const params = new URLSearchParams({
      file: "training",
      version: TRAINING_VERSION,
      actionType: "setTraining",
      teamId: String(teamId),
      trainingType: String(trainingType),
    });
    if (trainingLevel !== null) {
      params.set("trainingLevel", String(trainingLevel));
    }
    if (trainingLevelStamina !== null) {
      params.set("trainingLevelStamina", String(trainingLevelStamina));
    }

    const { parsed, rawXml } = await fetchChppXml(auth, params);
    return NextResponse.json({ data: parsed, raw: rawXml });
  } catch (error) {
    if (error instanceof ChppPermissionError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.message,
          code: error.code,
          missingPermissions: error.missingPermissions,
        },
        { status: error.status }
      );
    }
    if (error instanceof ChppAuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    const payload = buildChppErrorPayload("Failed to set training", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
