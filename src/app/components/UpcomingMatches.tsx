import styles from "../page.module.css";

type MatchTeam = {
  HomeTeamName?: string;
  AwayTeamName?: string;
  HomeTeamID?: number;
  AwayTeamID?: number;
};

type Match = {
  MatchID: number;
  MatchDate?: string;
  Status?: string;
  OrdersGiven?: string | boolean;
  HomeTeam?: MatchTeam;
  AwayTeam?: MatchTeam;
};

type MatchesResponse = {
  data?: {
    HattrickData?: {
      Team?: {
        MatchList?: {
          Match?: Match[] | Match;
        };
      };
      MatchList?: {
        Match?: Match[] | Match;
      };
    };
  };
  error?: string;
  details?: string;
};

type UpcomingMatchesProps = {
  response: MatchesResponse;
};

function normalizeMatches(input?: Match[] | Match): Match[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

function parseDate(dateString?: string) {
  if (!dateString) return null;
  const parsed = new Date(dateString.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMatchDate(dateString?: string) {
  const parsed = parseDate(dateString);
  if (!parsed) return "Unknown date";
  return parsed.toLocaleString();
}

function sortByDate(matches: Match[]) {
  return [...matches].sort((a, b) => {
    const aTime = parseDate(a.MatchDate)?.getTime() ?? 0;
    const bTime = parseDate(b.MatchDate)?.getTime() ?? 0;
    return aTime - bTime;
  });
}

function renderMatch(match: Match) {
  return (
    <li key={match.MatchID} className={styles.matchItem}>
      <div className={styles.matchTeams}>
        <span>{match.HomeTeam?.HomeTeamName ?? "Home"}</span>
        <span className={styles.vs}>vs</span>
        <span>{match.AwayTeam?.AwayTeamName ?? "Away"}</span>
      </div>
      <div className={styles.matchMeta}>
        <span>{formatMatchDate(match.MatchDate)}</span>
        <span>Status: {match.Status ?? "Unknown"}</span>
        <span>
          Orders: {match.OrdersGiven === "true" || match.OrdersGiven === true
            ? "Set"
            : "Not set"}
        </span>
      </div>
    </li>
  );
}

export default function UpcomingMatches({ response }: UpcomingMatchesProps) {
  if (response.error) {
    return (
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Matches</h2>
        <p className={styles.errorText}>{response.error}</p>
        {response.details ? (
          <p className={styles.errorDetails}>{response.details}</p>
        ) : null}
      </div>
    );
  }

  const allMatches = normalizeMatches(
    response.data?.HattrickData?.MatchList?.Match ??
      response.data?.HattrickData?.Team?.MatchList?.Match
  );
  const upcoming = allMatches.filter((match) => match.Status === "UPCOMING");
  const sortedUpcoming = sortByDate(upcoming);
  const sortedAll = sortByDate(allMatches);

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>Matches</h2>
      {sortedUpcoming.length > 0 ? (
        <ul className={styles.matchList}>
          {sortedUpcoming.map(renderMatch)}
        </ul>
      ) : sortedAll.length > 0 ? (
        <>
          <p className={styles.muted}>
            No UPCOMING matches found. Showing recent matches instead.
          </p>
          <ul className={styles.matchList}>{sortedAll.map(renderMatch)}</ul>
        </>
      ) : (
        <p className={styles.muted}>No matches returned.</p>
      )}
    </div>
  );
}
