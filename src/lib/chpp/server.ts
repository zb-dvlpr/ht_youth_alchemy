import { cookies } from "next/headers";
import { XMLParser } from "fast-xml-parser";
import { getChppEnv } from "@/lib/chpp/env";
import { createNodeOAuthClient, getProtectedResource } from "@/lib/chpp/node-oauth";

export const CHPP_XML_ENDPOINT = "https://chpp.hattrick.org/chppxml.ashx";

type ChppClient = ReturnType<typeof createNodeOAuthClient>;

export type ChppAuth = {
  client: ChppClient;
  accessToken: string;
  accessSecret: string;
};

export class ChppAuthError extends Error {
  status = 401;

  constructor(message = "Missing CHPP access token. Re-auth required.") {
    super(message);
  }
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export function parseChppXml(rawXml: string) {
  return xmlParser.parse(rawXml);
}

export function buildChppUrl(params: URLSearchParams) {
  return `${CHPP_XML_ENDPOINT}?${params.toString()}`;
}

export async function getChppAuth(): Promise<ChppAuth> {
  const { consumerKey, consumerSecret, callbackUrl } = getChppEnv();
  const client = createNodeOAuthClient(consumerKey, consumerSecret, callbackUrl);

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("chpp_access_token")?.value;
  const accessSecret = cookieStore.get("chpp_access_secret")?.value;

  if (!accessToken || !accessSecret) {
    throw new ChppAuthError();
  }

  return { client, accessToken, accessSecret };
}

export async function fetchChppXml(
  auth: ChppAuth,
  paramsOrUrl: URLSearchParams | string
) {
  const requestUrl =
    typeof paramsOrUrl === "string" ? paramsOrUrl : buildChppUrl(paramsOrUrl);
  const rawXml = await getProtectedResource(
    auth.client,
    requestUrl,
    auth.accessToken,
    auth.accessSecret
  );

  return { rawXml, parsed: parseChppXml(rawXml) };
}

export function buildChppErrorPayload(message: string, error: unknown) {
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

  return {
    error: message,
    details,
    ...(errorObject
      ? {
          statusCode: errorObject.statusCode ?? null,
          data: errorObject.data ?? null,
        }
      : {}),
  };
}
