import { cookies, headers } from "next/headers";
import Image from "next/image";
import styles from "./page.module.css";
import Dashboard from "./components/Dashboard";
import LanguageSwitcher from "./components/LanguageSwitcher";
import pkg from "../../package.json";
import { getMessages, Locale } from "@/lib/i18n";
import RatingsMatrix from "./components/RatingsMatrix";

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName: string;
  LastName: string;
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

    const response = await fetch(`${baseUrl}/api/chpp/youth/players`, {
      cache: "no-store",
      headers: {
        cookie: cookieStore.toString(),
      },
    });
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

  const [playersResponse, matchesResponse, ratingsResponse] =
    await Promise.all([getPlayers(), getMatches(), getRatings()]);

  const players = normalizePlayers(
    playersResponse.data?.HattrickData?.PlayerList?.YouthPlayer
  );

  return (
    <main className={styles.main}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <Image
            src="/logo.png"
            alt="Hattrick Youth Alchemy"
            width={140}
            height={140}
            priority
            className={styles.logo}
          />
        </div>
        <div className={styles.topBarControls}>
          <LanguageSwitcher locale={locale} label={messages.languageLabel} />
          <div className={styles.version}>v{pkg.version}</div>
        </div>
      </header>

      {playersResponse.error ? (
        <div className={styles.errorBox}>
          <h2 className={styles.sectionTitle}>{messages.unableToLoadPlayers}</h2>
          <p className={styles.errorText}>{playersResponse.error}</p>
          {playersResponse.details ? (
            <p className={styles.errorDetails}>{playersResponse.details}</p>
          ) : null}
        </div>
      ) : (
        <>
          <Dashboard
            players={players}
            matchesResponse={matchesResponse}
            messages={messages}
          />
          <div className={styles.matrixSpacing} />
          <RatingsMatrix response={ratingsResponse} messages={messages} />
        </>
      )}
    </main>
  );
}
