import { cookies, headers } from "next/headers";
import styles from "./page.module.css";
import Dashboard from "./components/Dashboard";
import ConnectedStatus from "./components/ConnectedStatus";
import LanguageSwitcher from "./components/LanguageSwitcher";
import NotificationCenter from "./components/notifications/NotificationCenter";
import { NotificationsProvider } from "./components/notifications/NotificationsProvider";
import pkg from "../../package.json";
import { getMessages, Locale } from "@/lib/i18n";

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName: string;
  LastName: string;
  Specialty?: number;
  Age?: number;
  ArrivalDate?: string;
  CanBePromotedIn?: number;
  PlayerSkills?: Record<string, unknown>;
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
};

type MatchesResponse = {
  data?: {
    HattrickData?: {
      MatchList?: {
        Match?: unknown;
      };
      Team?: {
        MatchList?: {
          Match?: unknown;
        };
      };
    };
  };
  error?: string;
  details?: string;
};

type RatingsMatrixResponse = {
  players: {
    id: number;
    name: string;
    lastMatch: {
      date: string | null;
      youthMatchId: number | null;
      positionCode: number | null;
      minutes: number | null;
      rating: number | null;
    } | null;
  }[];
};

async function getBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

async function getPlayers(): Promise<YouthPlayerListResponse> {
  try {
    const baseUrl = await getBaseUrl();
    const cookieStore = await cookies();

    const response = await fetch(
      `${baseUrl}/api/chpp/youth/players?actionType=details`,
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

async function getMatches(): Promise<MatchesResponse> {
  try {
    const baseUrl = await getBaseUrl();
    const cookieStore = await cookies();

    const response = await fetch(`${baseUrl}/api/chpp/matches?isYouth=true`, {
      cache: "no-store",
      headers: {
        cookie: cookieStore.toString(),
      },
    });
    return response.json();
  } catch (error) {
    return {
      error: "Failed to fetch matches",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getRatings(): Promise<RatingsMatrixResponse | null> {
  try {
    const baseUrl = await getBaseUrl();
    const cookieStore = await cookies();

    const response = await fetch(`${baseUrl}/api/chpp/youth/ratings`, {
      cache: "no-store",
      headers: {
        cookie: cookieStore.toString(),
      },
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function normalizePlayers(input?: YouthPlayer[] | YouthPlayer): YouthPlayer[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

export default async function Home() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("lang")?.value as Locale | undefined) ?? "en";
  const messages = getMessages(locale);
  const isConnected = Boolean(cookieStore.get("chpp_access_token")?.value);

  const [playersResponse, matchesResponse, ratingsResponse] =
    await Promise.all([getPlayers(), getMatches(), getRatings()]);

  const players = normalizePlayers(
    playersResponse.data?.HattrickData?.PlayerList?.YouthPlayer
  );

  return (
    <main className={styles.main}>
      <NotificationsProvider>
        <header className={styles.topBar}>
          <div className={styles.brandRow}>
            <span className={styles.brandTitle}>{messages.brandTitle}</span>
            <span className={styles.version}>v{pkg.version}</span>
          </div>
          <NotificationCenter locale={locale} messages={messages} />
          <div className={styles.topBarControls}>
            <LanguageSwitcher locale={locale} label={messages.languageLabel} />
            {isConnected ? (
              <ConnectedStatus messages={messages} />
            ) : (
              <a className={styles.connectButton} href="/api/chpp/oauth/start">
                {messages.connectLabel}
              </a>
            )}
          </div>
        </header>

        {playersResponse.error ? (
          <div className={styles.errorBox}>
            <h2 className={styles.sectionTitle}>
              {messages.unableToLoadPlayers}
            </h2>
            <p className={styles.errorText}>{playersResponse.error}</p>
            {playersResponse.details ? (
              <p className={styles.errorDetails}>{playersResponse.details}</p>
            ) : null}
          </div>
        ) : (
          <Dashboard
            players={players}
            matchesResponse={matchesResponse}
            ratingsResponse={ratingsResponse}
            messages={messages}
          />
        )}
      </NotificationsProvider>
    </main>
  );
}
