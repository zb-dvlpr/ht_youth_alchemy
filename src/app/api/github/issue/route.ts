import { NextResponse } from "next/server";
import {
  createGitHubIssue,
  type GitHubIssueKind,
} from "@/lib/github/app";
import {
  extractManagerIdentityFromManagerCompendium,
  extractManagerIdentityFromTeamDetails,
  isFeedbackManagerIdentity,
  type FeedbackManagerIdentity,
} from "@/lib/hattrick/managerIdentity";
import { hattrickComposeMailUrl } from "@/lib/hattrick/urls";
import { fetchChppXml, getChppAuth } from "@/lib/chpp/server";
import { getMessages, type Locale } from "@/lib/i18n";

export const runtime = "nodejs";

const MANAGERCOMPENDIUM_VERSION = "1.7";
const TEAMDETAILS_VERSION = "3.9";

type FeedbackIssueRequest = {
  kind?: GitHubIssueKind;
  title?: string;
  problem?: string;
  reproduce?: string;
  expected?: string;
  actual?: string;
  proposed?: string;
  alternatives?: string;
  notes?: string;
  locale?: string;
  appVersion?: string;
  managerUserId?: string;
  managerLoginname?: string;
};

const MAX_TITLE_LENGTH = 140;
const MAX_FIELD_LENGTH = 4000;

const sanitizeText = (
  value: unknown,
  maxLength = MAX_FIELD_LENGTH
): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
};

const renderMarkdownSection = (label: string, value: string | null) =>
  value ? `## ${label}\n\n${value}` : null;

const normalizeLocale = (value: unknown): Locale | undefined => {
  if (
    value === "en" ||
    value === "de" ||
    value === "fr" ||
    value === "es" ||
    value === "sv" ||
    value === "it" ||
    value === "pt" ||
    value === "pl" ||
    value === "nl"
  ) {
    return value;
  }
  return undefined;
};

const escapeMarkdownLinkText = (value: string) =>
  value.replace(/([\\[\]])/g, "\\$1");

const buildIssueTitle = (kind: GitHubIssueKind, title: string) =>
  kind === "bug"
    ? `[BUG REPORT] ${title}`
    : `[FEATURE REQUEST] ${title}`;

const buildIssueLabels = (kind: GitHubIssueKind) =>
  kind === "bug"
    ? ["bug", "from-app"]
    : ["enhancement", "from-app"];

const buildIssueBody = (
  payload: Required<
    Pick<FeedbackIssueRequest, "kind" | "title">
  > &
    Omit<FeedbackIssueRequest, "kind" | "title"> & {
      managerIdentity: FeedbackManagerIdentity;
    },
  request: Request,
  locale: Locale | undefined
) => {
  const messages = getMessages(locale);
  const sections =
    payload.kind === "bug"
      ? [
          renderMarkdownSection("Problem", payload.problem ?? null),
          renderMarkdownSection("How to reproduce", payload.reproduce ?? null),
          renderMarkdownSection("Expected behavior", payload.expected ?? null),
          renderMarkdownSection("Actual behavior", payload.actual ?? null),
          renderMarkdownSection("Extra notes", payload.notes ?? null),
        ]
      : [
          renderMarkdownSection("Problem", payload.problem ?? null),
          renderMarkdownSection("Proposed solution", payload.proposed ?? null),
          renderMarkdownSection(
            "Alternatives considered",
            payload.alternatives ?? null
          ),
          renderMarkdownSection("Extra notes", payload.notes ?? null),
        ];

  const metadata = [
    `- ${messages.feedbackMetadataHattrickUser}: [${escapeMarkdownLinkText(
      payload.managerIdentity.loginname
    )}](${hattrickComposeMailUrl(payload.managerIdentity.userId)}) (${payload.managerIdentity.userId})`,
    `- App version: ${payload.appVersion ?? "unknown"}`,
    `- Locale: ${payload.locale ?? "unknown"}`,
    `- Submitted at: ${new Date().toISOString()}`,
    `- User agent: ${request.headers.get("user-agent") ?? "unknown"}`,
  ].join("\n");

  return [...sections.filter(Boolean), "## Metadata\n\n" + metadata].join("\n\n");
};

const getRequestManagerIdentity = (
  body: FeedbackIssueRequest | null
): FeedbackManagerIdentity | null => {
  const userId = sanitizeText(body?.managerUserId, 64);
  const loginname = sanitizeText(body?.managerLoginname, 128);
  if (!userId || !loginname) return null;
  return { userId, loginname };
};

const fetchManagerIdentityFromChpp = async () => {
  const auth = await getChppAuth();
  const managerCompendium = await fetchChppXml(
    auth,
    new URLSearchParams({
      file: "managercompendium",
      version: MANAGERCOMPENDIUM_VERSION,
    })
  );
  const cachedManagerIdentity = extractManagerIdentityFromManagerCompendium(
    managerCompendium.parsed
  );
  if (cachedManagerIdentity) return cachedManagerIdentity;

  const teamDetails = await fetchChppXml(
    auth,
    new URLSearchParams({
      file: "teamdetails",
      version: TEAMDETAILS_VERSION,
    })
  );
  return extractManagerIdentityFromTeamDetails(teamDetails.parsed);
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | FeedbackIssueRequest
      | null;
    const locale = normalizeLocale(body?.locale);
    const messages = getMessages(locale);
    const kind = body?.kind === "feature" ? "feature" : body?.kind === "bug" ? "bug" : null;
    const title = sanitizeText(body?.title, MAX_TITLE_LENGTH);

    if (!kind) {
      return NextResponse.json({ error: "Invalid issue kind" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const managerIdentity =
      getRequestManagerIdentity(body) ?? (await fetchManagerIdentityFromChpp());
    if (!isFeedbackManagerIdentity(managerIdentity)) {
      return NextResponse.json(
        { error: messages.feedbackManagerIdentityRequiredError },
        { status: 500 }
      );
    }

    const issue = await createGitHubIssue({
      kind,
      title: buildIssueTitle(kind, title),
      body: buildIssueBody(
        {
          kind,
          title,
          problem: sanitizeText(body?.problem) ?? undefined,
          reproduce: sanitizeText(body?.reproduce) ?? undefined,
          expected: sanitizeText(body?.expected) ?? undefined,
          actual: sanitizeText(body?.actual) ?? undefined,
          proposed: sanitizeText(body?.proposed) ?? undefined,
          alternatives: sanitizeText(body?.alternatives) ?? undefined,
          notes: sanitizeText(body?.notes) ?? undefined,
          locale: sanitizeText(body?.locale, 32) ?? undefined,
          appVersion: sanitizeText(body?.appVersion, 32) ?? undefined,
          managerIdentity,
        },
        request,
        locale
      ),
      labels: buildIssueLabels(kind),
    });

    return NextResponse.json({ ok: true, ...issue });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Issue submission failed",
        details:
          error instanceof Error
            ? error.message
            : "Unknown issue submission error",
      },
      { status: 500 }
    );
  }
}
