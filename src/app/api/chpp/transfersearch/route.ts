import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const TRANSFERSEARCH_VERSION = "1.1";

const PASSTHROUGH_KEYS = [
  "ageMin",
  "ageDaysMin",
  "ageMax",
  "ageDaysMax",
  "skillType1",
  "minSkillValue1",
  "maxSkillValue1",
  "skillType2",
  "minSkillValue2",
  "maxSkillValue2",
  "skillType3",
  "minSkillValue3",
  "maxSkillValue3",
  "skillType4",
  "minSkillValue4",
  "maxSkillValue4",
  "specialty",
  "nativeCountryId",
  "tsiMin",
  "tsiMax",
  "priceMin",
  "priceMax",
  "pageSize",
  "pageIndex",
] as const;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "transfersearch",
      version: url.searchParams.get("version") ?? TRANSFERSEARCH_VERSION,
    });

    PASSTHROUGH_KEYS.forEach((key) => {
      const value = url.searchParams.get(key);
      if (value) {
        params.set(key, value);
      }
    });

    const { rawXml, parsed } = await fetchChppXml(auth, params);
    const includeRaw = url.searchParams.get("raw") === "1";

    return NextResponse.json({
      data: parsed,
      ...(includeRaw ? { raw: rawXml } : {}),
    });
  } catch (error) {
    if (error instanceof ChppAuthError) {
      return NextResponse.json(
        { error: error.message, code: "CHPP_AUTH_MISSING" },
        { status: error.status }
      );
    }
    const payload = buildChppErrorPayload("Failed to fetch transfer search", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
