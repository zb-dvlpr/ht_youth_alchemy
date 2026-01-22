import { cookies, headers } from "next/headers";
import styles from "./page.module.css";
import YouthPlayerList from "./components/YouthPlayerList";
import UpcomingMatches from "./components/UpcomingMatches";

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
    };
  };
  error?: string;
  details?: string;
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

function normalizePlayers(input?: YouthPlayer[] | YouthPlayer): YouthPlayer[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

export default async function Home() {
  const [playersResponse, matchesResponse] = await Promise.all([
    getPlayers(),
    getMatches(),
  ]);

  const players = normalizePlayers(
    playersResponse.data?.HattrickData?.PlayerList?.YouthPlayer
  );

  return (
    <main className={styles.main}>
      <div className={styles.center}>
        <h1 className={styles.title}>Youth Alchemy</h1>
        <p className={styles.subtitle}>
          Connected youth players (via CHPP)
        </p>
      </div>

      {playersResponse.error ? (
        <div className={styles.errorBox}>
          <h2 className={styles.sectionTitle}>Unable to load players</h2>
          <p className={styles.errorText}>{playersResponse.error}</p>
          {playersResponse.details ? (
            <p className={styles.errorDetails}>{playersResponse.details}</p>
          ) : null}
        </div>
      ) : (
        <YouthPlayerList players={players} />
      )}

      <div className={styles.sectionSpacing} />

      <UpcomingMatches response={matchesResponse} />
    </main>
  );
}
