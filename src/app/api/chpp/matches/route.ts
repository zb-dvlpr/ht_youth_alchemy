import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { XMLParser } from "fast-xml-parser";
import { getChppEnv } from "@/lib/chpp/env";
import { createNodeOAuthClient, getProtectedResource } from "@/lib/chpp/node-oauth";

const CHPP_XML_ENDPOINT = "https://chpp.hattrick.org/chppxml.ashx";
const DEFAULT_VERSION = "2.9";

function buildParams(url: URL) {
  const version = url.searchParams.get("version") ?? DEFAULT_VERSION;
  const isYouth = url.searchParams.get("isYouth") ?? "true";
  const teamID = url.searchParams.get("teamID");
  const lastMatchDate = url.searchParams.get("lastMatchDate");

  const params = new URLSearchParams({
    file: "matches",
    version,
    isYouth,
  });

  if (teamID) params.set("teamID", teamID);
  if (lastMatchDate) params.set("lastMatchDate", lastMatchDate);

  return params;
}

export async function GET(request: Request) {
  try {
    const { consumerKey, consumerSecret, callbackUrl } = getChppEnv();
    const client = createNodeOAuthClient(
      consumerKey,
      consumerSecret,
      callbackUrl
    );

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("chpp_access_token")?.value;
    const accessSecret = cookieStore.get("chpp_access_secret")?.value;

    if (!accessToken || !accessSecret) {
      return NextResponse.json(
        { error: "Missing CHPP access token. Re-auth required." },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const params = buildParams(url);
    const requestUrl = `${CHPP_XML_ENDPOINT}?${params.toString()}`;

    const rawXml = await getProtectedResource(
      client,
      requestUrl,
      accessToken,
      accessSecret
    );

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const parsed = parser.parse(rawXml);

    const includeRaw = url.searchParams.get("raw") === "1";

    return NextResponse.json({
      data: parsed,
      ...(includeRaw ? { raw: rawXml } : {}),
    });
  } catch (error) {
    const details =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : JSON.stringify(error);
    const errorObject =
      error && typeof error === "object" && !Array.isArray(error)
        ? (error as Record<string, unknown>)
        : null;
    return NextResponse.json(
      {
        error: "Failed to fetch matches",
        details,
        ...(errorObject
          ? {
              statusCode: errorObject.statusCode ?? null,
              data: errorObject.data ?? null,
            }
          : {}),
      },
      { status: 502 }
    );
  }
}
