export type FeedbackManagerIdentity = {
  userId: string;
  loginname: string;
};

type ManagerCompendiumData = {
  HattrickData?: {
    Manager?: Record<string, unknown> & {
      UserId?: number | string;
      UserID?: number | string;
      Loginname?: string;
    };
  };
};

type TeamDetailsData = {
  HattrickData?: {
    User?: Record<string, unknown> & {
      UserId?: number | string;
      UserID?: number | string;
      Loginname?: string;
    };
  };
};

const normalizeText = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export function isFeedbackManagerIdentity(
  value: FeedbackManagerIdentity | null | undefined
): value is FeedbackManagerIdentity {
  return Boolean(
    value &&
      normalizeText(value.userId) &&
      normalizeText(value.loginname)
  );
}

export function extractManagerIdentityFromManagerCompendium(
  data: ManagerCompendiumData | null | undefined
): FeedbackManagerIdentity | null {
  const manager = data?.HattrickData?.Manager;
  const userId = normalizeText(manager?.UserId ?? manager?.UserID);
  const loginname = normalizeText(manager?.Loginname);
  if (!userId || !loginname) return null;
  return { userId, loginname };
}

export function extractManagerIdentityFromTeamDetails(
  data: TeamDetailsData | null | undefined
): FeedbackManagerIdentity | null {
  const user = data?.HattrickData?.User;
  const userId = normalizeText(user?.UserId ?? user?.UserID);
  const loginname = normalizeText(user?.Loginname);
  if (!userId || !loginname) return null;
  return { userId, loginname };
}
