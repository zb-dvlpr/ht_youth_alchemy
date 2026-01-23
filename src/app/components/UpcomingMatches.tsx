import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";

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
  messages: Messages;
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

function formatMatchDate(dateString?: string, unknownDate: string) {
  const parsed = parseDate(dateString);
  if (!parsed) return unknownDate;
  return parsed.toLocaleString();
}

function sortByDate(matches: Match[]) {
  return [...matches].sort((a, b) => {
    const aTime = parseDate(a.MatchDate)?.getTime() ?? 0;
    const bTime = parseDate(b.MatchDate)?.getTime() ?? 0;
    return aTime - bTime;
  });
}

function renderMatch(match: Match, messages: Messages) {
  return (
    <li key={match.MatchID} className={styles.matchItem}>
      <div className={styles.matchTeams}>
        <span>{match.HomeTeam?.HomeTeamName ?? messages.homeLabel}</span>
        <span className={styles.vs}>vs</span>
        <span>{match.AwayTeam?.AwayTeamName ?? messages.awayLabel}</span>
      </div>
      <div className={styles.matchMeta}>
        <span>{formatMatchDate(match.MatchDate, messages.unknownDate)}</span>
        <span>
          {messages.statusLabel}: {match.Status ?? messages.unknownLabel}
        </span>
        <span>
          {messages.ordersLabel}: {match.OrdersGiven === "true" || match.OrdersGiven === true
            ? messages.ordersSet
            : messages.ordersNotSet}
        </span>
      </div>
    </li>
  );
}

export default function UpcomingMatches({ response, messages }: UpcomingMatchesProps) {
  if (response.error) {
    return (
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>{messages.matchesTitle}</h2>
        <p className={styles.errorText}>{messages.unableToLoadMatches}</p>
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
      <h2 className={styles.sectionTitle}>{messages.matchesTitle}</h2>
      {sortedUpcoming.length > 0 ? (
        <ul className={styles.matchList}>
          {sortedUpcoming.map((match) => renderMatch(match, messages))}
        </ul>
      ) : sortedAll.length > 0 ? (
        <>
          <p className={styles.muted}>{messages.noUpcomingMatches}</p>
          <ul className={styles.matchList}>
            {sortedAll.map((match) => renderMatch(match, messages))}
          </ul>
        </>
      ) : (
        <p className={styles.muted}>{messages.noMatchesReturned}</p>
      )}
    </div>
  );
}
