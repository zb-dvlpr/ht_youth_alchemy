import { NextResponse } from "next/server";
import {
  createGitHubIssue,
  type GitHubIssueKind,
} from "@/lib/github/app";

export const runtime = "nodejs";

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
    Omit<FeedbackIssueRequest, "kind" | "title">,
  request: Request
) => {
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
    `- App version: ${payload.appVersion ?? "unknown"}`,
    `- Locale: ${payload.locale ?? "unknown"}`,
    `- Submitted at: ${new Date().toISOString()}`,
    `- User agent: ${request.headers.get("user-agent") ?? "unknown"}`,
  ].join("\n");

  return [...sections.filter(Boolean), "## Metadata\n\n" + metadata].join("\n\n");
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | FeedbackIssueRequest
      | null;
    const kind = body?.kind === "feature" ? "feature" : body?.kind === "bug" ? "bug" : null;
    const title = sanitizeText(body?.title, MAX_TITLE_LENGTH);

    if (!kind) {
      return NextResponse.json({ error: "Invalid issue kind" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
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
        },
        request
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
