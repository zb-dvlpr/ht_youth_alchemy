import { createSign } from "node:crypto";

export type GitHubIssueKind = "bug" | "feature";

export type GitHubIssuePayload = {
  kind: GitHubIssueKind;
  title: string;
  body: string;
  labels: string[];
};

type GitHubIssueEnv = {
  appId: string;
  privateKey: string;
  installationId: string;
  owner: string;
  repo: string;
};

type InstallationTokenResponse = {
  token?: string;
  expires_at?: string;
  message?: string;
};

type CreateIssueResponse = {
  html_url?: string;
  number?: number;
  message?: string;
};

const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_APP_USER_AGENT = "ht-youth-alchemy-feedback";

const base64UrlEncode = (value: string | Buffer) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const normalizePrivateKey = (privateKey: string) =>
  privateKey.replace(/\r/g, "").replace(/\\n/g, "\n").trim();

export function getGitHubIssueEnv(): GitHubIssueEnv {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.trim();
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID?.trim();
  const owner = process.env.GITHUB_ISSUES_OWNER?.trim();
  const repo = process.env.GITHUB_ISSUES_REPO?.trim();

  const missing = [
    !appId ? "GITHUB_APP_ID" : null,
    !privateKey ? "GITHUB_APP_PRIVATE_KEY" : null,
    !installationId ? "GITHUB_APP_INSTALLATION_ID" : null,
    !owner ? "GITHUB_ISSUES_OWNER" : null,
    !repo ? "GITHUB_ISSUES_REPO" : null,
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Missing required GitHub issue env vars: ${missing.join(", ")}`
    );
  }

  return {
    appId: appId!,
    privateKey: normalizePrivateKey(privateKey!),
    installationId: installationId!,
    owner: owner!,
    repo: repo!,
  };
}

const createAppJwt = (appId: string, privateKey: string) => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  );
  const payload = base64UrlEncode(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: appId,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer
    .sign(privateKey, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${signingInput}.${signature}`;
};

const getInstallationAccessToken = async (env: GitHubIssueEnv) => {
  const appJwt = createAppJwt(env.appId, env.privateKey);
  const response = await fetch(
    `https://api.github.com/app/installations/${encodeURIComponent(
      env.installationId
    )}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${appJwt}`,
        "User-Agent": GITHUB_APP_USER_AGENT,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
      cache: "no-store",
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | InstallationTokenResponse
    | null;
  if (!response.ok || !payload?.token) {
    throw new Error(payload?.message || "Failed to obtain GitHub installation token");
  }
  return payload.token;
};

export async function createGitHubIssue(payload: GitHubIssuePayload) {
  const env = getGitHubIssueEnv();
  const installationToken = await getInstallationAccessToken(env);
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(
      env.owner
    )}/${encodeURIComponent(env.repo)}/issues`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${installationToken}`,
        "Content-Type": "application/json",
        "User-Agent": GITHUB_APP_USER_AGENT,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
      body: JSON.stringify({
        title: payload.title,
        body: payload.body,
        labels: payload.labels,
      }),
      cache: "no-store",
    }
  );

  const issue = (await response.json().catch(() => null)) as
    | CreateIssueResponse
    | null;
  if (!response.ok || typeof issue?.number !== "number" || !issue.html_url) {
    throw new Error(issue?.message || "Failed to create GitHub issue");
  }
  return {
    issueNumber: issue.number,
    issueUrl: issue.html_url,
  };
}
