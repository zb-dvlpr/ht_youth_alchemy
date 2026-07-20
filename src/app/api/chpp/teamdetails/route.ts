import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const TEAMDETAILS_VERSION = "3.9";

type XmlRecord = Record<string, unknown>;

function asRecord(value: unknown): XmlRecord | null {
  return value && typeof value === "object" ? (value as XmlRecord) : null;
}

function normalizeTeamLeagueLevelUnit(teamValue: unknown) {
  const team = asRecord(teamValue);
  if (!team) return;

  const leagueLevelUnit = asRecord(team.LeagueLevelUnit);
  if (!leagueLevelUnit) return;

  const leagueLevelUnitId =
    leagueLevelUnit.LeagueLevelUnitID ?? leagueLevelUnit.LeagueLevelUnitId;

  if (
    leagueLevelUnitId !== undefined &&
    team.LeagueLevelUnitID === undefined &&
    team.LeagueLevelUnitId === undefined
  ) {
    team.LeagueLevelUnitID = leagueLevelUnitId;
  }
}

function normalizeTeamDetailsPayload(parsed: unknown) {
  const parsedRecord = asRecord(parsed);
  const hattrickData = asRecord(parsedRecord?.HattrickData);
  if (!hattrickData) return parsed;

  normalizeTeamLeagueLevelUnit(hattrickData.Team);

  const teams = asRecord(hattrickData.Teams);
  const teamList = teams?.Team;

  if (Array.isArray(teamList)) {
    teamList.forEach(normalizeTeamLeagueLevelUnit);
  } else {
    normalizeTeamLeagueLevelUnit(teamList);
  }

  return parsed;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");
    const userId = searchParams.get("userId");

    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "teamdetails",
      version: TEAMDETAILS_VERSION,
    });
    if (teamId) {
      params.set("teamID", teamId);
    } else if (userId) {
      params.set("userID", userId);
    }

    const { parsed, rawXml } = await fetchChppXml(auth, params);
    return NextResponse.json({ data: normalizeTeamDetailsPayload(parsed), raw: rawXml });
  } catch (error) {
    if (error instanceof ChppAuthError) {
      return NextResponse.json(
        { error: error.message, code: "CHPP_AUTH_MISSING" },
        { status: error.status }
      );
    }
    const payload = buildChppErrorPayload("Failed to fetch team details", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
