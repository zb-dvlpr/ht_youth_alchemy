type OAuthErrorRedirectInput = {
  requestUrl: string;
  phase: "start" | "callback";
  statusCode?: number | null;
  code?: string | null;
};

export function buildOauthErrorRedirectUrl(input: OAuthErrorRedirectInput) {
  const redirectUrl = new URL("/", input.requestUrl);
  redirectUrl.searchParams.set("chpp_oauth_error", "1");
  redirectUrl.searchParams.set("phase", input.phase);

  if (
    typeof input.statusCode === "number" &&
    Number.isFinite(input.statusCode)
  ) {
    redirectUrl.searchParams.set("status", String(input.statusCode));
  }

  if (input.code) {
    redirectUrl.searchParams.set("code", input.code);
  }

  return redirectUrl;
}
