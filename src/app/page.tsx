import { cookies, headers } from "next/headers";
import Image from "next/image";
import styles from "./page.module.css";
import Dashboard from "./components/Dashboard";
import pkg from "../../package.json";

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
        <Image
          src="/logo.png"
          alt="Hattrick Youth Alchemy"
          width={320}
          height={320}
          priority
          className={styles.logo}
        />
        <div className={styles.version}>v{pkg.version}</div>
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
        <Dashboard players={players} matchesResponse={matchesResponse} />
      )}
    </main>
  );
}
