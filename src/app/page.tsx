import { cookies, headers } from "next/headers";
import styles from "./page.module.css";
import Dashboard from "./components/Dashboard";
import ConnectedStatus from "./components/ConnectedStatus";
import LanguageSwitcher from "./components/LanguageSwitcher";
import NotificationCenter from "./components/notifications/NotificationCenter";
import { NotificationsProvider } from "./components/notifications/NotificationsProvider";
import HelpToggleButton from "./components/HelpToggleButton";
import ThemeToggle from "./components/ThemeToggle";
import ViewportScaler from "./components/ViewportScaler";
import FeedbackButton from "./components/FeedbackButton";
import SettingsButton from "./components/SettingsButton";
import AppShell from "./components/AppShell";
import pkg from "../../package.json";
import { getMessages, Locale } from "@/lib/i18n";
import type { MatchesResponse } from "./components/UpcomingMatches";
import type { RatingsMatrixResponse } from "./components/RatingsMatrix";

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName: string;
  LastName: string;
  Specialty?: number;
  Age?: number;
  ArrivalDate?: string;
  CanBePromotedIn?: number;
  PlayerSkills?: Record<string, SkillValue>;
};

type SkillValue = {
  "#text"?: number | string;
  "@_IsAvailable"?: string;
  "@_IsMaxReached"?: string;
  "@_MayUnlock"?: string;
};

type YouthPlayerListResponse = {
  data?: {
    HattrickData?: {
      PlayerList?: {
        YouthPlayer?: YouthPlayer[] | YouthPlayer;
      };
    };
  };
  error?: string;
  details?: string;
  code?: string;
  statusCode?: number;
};

type ManagerCompendiumResponse = {
  data?: {
    HattrickData?: {
      Manager?: {
        Teams?: {
          Team?: ManagerTeam | ManagerTeam[];
        };
      };
    };
  };
  error?: string;
  details?: string;
  code?: string;
  statusCode?: number;
};

type ManagerTeam = {
  TeamId?: number | string;
  TeamName?: string;
  YouthTeam?: {
    YouthTeamId?: number | string;
    YouthTeamName?: string;
    YouthLeague?: {
      YouthLeagueId?: number | string;
      YouthLeagueName?: string;
    };
  };
};

export type YouthTeamOption = {
  teamId: number;
  teamName: string;
  youthTeamId: number;
  youthTeamName: string;
  youthLeagueName?: string | null;
};

async function getBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const isLocalhost =
    host?.startsWith("localhost") || host?.startsWith("127.0.0.1");
  const protocol = forwardedProto ?? (isLocalhost ? "http" : "https");
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

async function getPlayers(
  youthTeamId?: number | null
): Promise<YouthPlayerListResponse> {
  try {
    const baseUrl = await getBaseUrl();
    const cookieStore = await cookies();
    const teamParam = youthTeamId ? `&youthTeamID=${youthTeamId}` : "";

    const response = await fetch(
      `${baseUrl}/api/chpp/youth/players?actionType=details${teamParam}`,
      {
        cache: "no-store",
        headers: {
          cookie: cookieStore.toString(),
        },
      }
    );
    return response.json();
  } catch (error) {
    return {
      error: "Failed to fetch youth players",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getMatches(teamId?: number | null): Promise<MatchesResponse> {
  try {
    const baseUrl = await getBaseUrl();
    const cookieStore = await cookies();
    const teamParam = teamId ? `&teamID=${teamId}` : "";

    const response = await fetch(
      `${baseUrl}/api/chpp/matches?isYouth=true${teamParam}`,
      {
        cache: "no-store",
        headers: {
          cookie: cookieStore.toString(),
        },
      }
    );
    return response.json();
  } catch (error) {
    return {
      error: "Failed to fetch matches",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getRatings(
  teamId?: number | null
): Promise<RatingsMatrixResponse | null> {
  try {
    const baseUrl = await getBaseUrl();
    const cookieStore = await cookies();
    const teamParam = teamId ? `?teamID=${teamId}` : "";

    const response = await fetch(
      `${baseUrl}/api/chpp/youth/ratings${teamParam}`,
      {
        cache: "no-store",
        headers: {
          cookie: cookieStore.toString(),
        },
      }
    );

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function getManagerCompendium(): Promise<ManagerCompendiumResponse> {
  try {
    const baseUrl = await getBaseUrl();
    const cookieStore = await cookies();

    const response = await fetch(`${baseUrl}/api/chpp/managercompendium`, {
      cache: "no-store",
      headers: {
        cookie: cookieStore.toString(),
      },
    });
    return response.json();
  } catch (error) {
    return {
      error: "Failed to fetch manager compendium",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

function normalizePlayers(input?: YouthPlayer[] | YouthPlayer): YouthPlayer[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

function normalizeTeams(input?: ManagerTeam[] | ManagerTeam): ManagerTeam[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

function extractYouthTeams(response: ManagerCompendiumResponse): YouthTeamOption[] {
  const teams = normalizeTeams(
    response.data?.HattrickData?.Manager?.Teams?.Team
  );
  return teams.reduce<YouthTeamOption[]>((acc, team) => {
    const youthTeamId = Number(team.YouthTeam?.YouthTeamId ?? 0);
    if (!youthTeamId) return acc;
    acc.push({
      teamId: Number(team.TeamId ?? 0),
      teamName: team.TeamName ?? "",
      youthTeamId,
      youthTeamName: team.YouthTeam?.YouthTeamName ?? "",
      youthLeagueName: team.YouthTeam?.YouthLeague?.YouthLeagueName ?? null,
    });
    return acc;
  }, []);
}

export default async function Home() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("lang")?.value as Locale | undefined) ?? "en";
  const messages = getMessages(locale);
  const isConnected = Boolean(cookieStore.get("chpp_access_token")?.value);

  const managerResponse = await getManagerCompendium();
  const youthTeams = extractYouthTeams(managerResponse);
  const defaultYouthTeamId = youthTeams.length > 1 ? youthTeams[0]?.youthTeamId : null;

  const [playersResponse, matchesResponse, ratingsResponse] =
    await Promise.all([
      getPlayers(defaultYouthTeamId),
      getMatches(defaultYouthTeamId),
      getRatings(defaultYouthTeamId),
    ]);

  const tokenError =
    playersResponse.code?.startsWith("CHPP_AUTH") ||
    playersResponse.error?.includes("Missing CHPP access token") ||
    playersResponse.details?.includes("Missing CHPP access token") ||
    playersResponse.error?.includes("Re-auth") ||
    playersResponse.details?.includes("Re-auth") ||
    playersResponse.error?.includes("authorization expired") ||
    playersResponse.details?.includes("authorization expired") ||
    playersResponse.details?.includes("401 - Unauthorized");

  const players = normalizePlayers(
    playersResponse.data?.HattrickData?.PlayerList?.YouthPlayer
  );

  return (
    <main className={styles.main} data-app-main="true">
      <ViewportScaler />
      <NotificationsProvider>
        <div className={styles.scaleContainer} data-scale-container="true">
          <header className={styles.topBar}>
            <div className={styles.brandRow}>
              <span className={styles.brandTitle}>{messages.brandTitle}</span>
              <span className={styles.version}>v{pkg.version}</span>
            </div>
            <NotificationCenter locale={locale} messages={messages} />
            <div className={styles.topBarControls}>
              <LanguageSwitcher
                locale={locale}
                label={messages.languageLabel}
                switchingLabel={messages.languageSwitching}
              />
              <HelpToggleButton messages={messages} />
              <ThemeToggle messages={messages} />
              <FeedbackButton messages={messages} />
              <SettingsButton messages={messages} />
              {isConnected ? (
                <ConnectedStatus messages={messages} />
              ) : (
                <a className={styles.connectButton} href="/api/chpp/oauth/start">
                  {messages.connectLabel}
                </a>
              )}
            </div>
          </header>

          <AppShell messages={messages}>
            <Dashboard
              players={players}
              matchesResponse={matchesResponse}
              ratingsResponse={ratingsResponse}
              initialYouthTeams={youthTeams}
              initialYouthTeamId={defaultYouthTeamId}
              appVersion={pkg.version}
              messages={messages}
              isConnected={isConnected}
              initialLoadError={playersResponse.error ?? null}
              initialLoadDetails={
                tokenError ? messages.connectHint : playersResponse.details ?? null
              }
              initialAuthError={Boolean(tokenError)}
            />
          </AppShell>
        </div>
      </NotificationsProvider>
    </main>
  );
}
