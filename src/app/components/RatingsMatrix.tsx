import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";

type RatingRow = {
  id: number;
  name: string;
  lastMatch: {
    date: string | null;
    youthMatchId: number | null;
    positionCode: number | null;
    minutes: number | null;
    rating: number | null;
  } | null;
};

type RatingsMatrixResponse = {
  players: RatingRow[];
};

type RatingsMatrixProps = {
  response: RatingsMatrixResponse | null;
  messages: Messages;
};

const POSITION_ORDER = [100, 101, 103, 107, 111];

function uniquePositions(rows: RatingRow[]) {
  const set = new Set<number>();
  rows.forEach((row) => {
    if (
      row.lastMatch?.positionCode !== null &&
      row.lastMatch?.positionCode !== undefined
    ) {
      set.add(normalizePosition(Number(row.lastMatch.positionCode)));
    }
  });
  return POSITION_ORDER.filter((code) => set.has(code));
}

function normalizePosition(code: number) {
  if (code === 100) return 100;
  if (code >= 101 && code <= 105) return 101;
  if (code >= 106 && code <= 110) return 106;
  if (code >= 107 && code <= 109) return 107;
  if (code >= 111 && code <= 113) return 111;
  return code;
}

function positionLabel(code: number, messages: Messages) {
  switch (code) {
    case 100:
      return messages.posKeeper;
    case 101:
      return messages.posBack;
    case 102:
    case 103:
    case 104:
      return messages.posCentralDefender;
    case 106:
    case 110:
      return messages.posWinger;
    case 107:
    case 108:
    case 109:
      return messages.posInnerMidfield;
    case 111:
    case 112:
    case 113:
      return messages.posForward;
    default:
      return `#${code}`;
  }
}

function formatRating(value: number | null) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(1);
}

export default function RatingsMatrix({ response, messages }: RatingsMatrixProps) {
  if (!response || response.players.length === 0) {
    return (
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>{messages.ratingsTitle}</h2>
        <p className={styles.muted}>{messages.noMatchesReturned}</p>
      </div>
    );
  }

  const positions = uniquePositions(response.players);

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>{messages.ratingsTitle}</h2>
      <div className={styles.matrixWrapper}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th>{messages.youthPlayerList}</th>
              {positions.map((position) => (
                <th key={position}>{positionLabel(position, messages)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {response.players.map((row) => (
              <tr key={row.id}>
                <td className={styles.matrixPlayer}>{row.name}</td>
                {positions.map((position) => {
                  const match = row.lastMatch;
                  const rating =
                    match &&
                    normalizePosition(Number(match.positionCode)) === position
                      ? match.rating
                      : null;
                  return <td key={position}>{formatRating(rating)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
