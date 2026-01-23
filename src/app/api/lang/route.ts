import { NextResponse } from "next/server";
import { SUPPORTED_LOCALES } from "@/lib/i18n";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { locale?: string }
    | null;
  const locale = body?.locale?.toLowerCase();

  const isSupported =
    !!locale &&
    SUPPORTED_LOCALES.includes(
      locale as (typeof SUPPORTED_LOCALES)[number]
    );
  if (!isSupported) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("lang", locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
