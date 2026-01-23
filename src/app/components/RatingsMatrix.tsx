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

const POSITION_ORDER = [
  100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113,
];

function uniquePositions(rows: RatingRow[]) {
  const set = new Set<number>();
  rows.forEach((row) => {
    if (
      row.lastMatch?.positionCode !== null &&
      row.lastMatch?.positionCode !== undefined
    ) {
      set.add(Number(row.lastMatch.positionCode));
    }
  });
  return POSITION_ORDER.filter((code) => set.has(code));
}

function positionLabel(code: number, messages: Messages) {
  switch (code) {
    case 100:
      return messages.posKeeper;
    case 101:
      return messages.posRightBack;
    case 102:
      return messages.posRightCentralDefender;
    case 103:
      return messages.posMiddleCentralDefender;
    case 104:
      return messages.posLeftCentralDefender;
    case 105:
      return messages.posLeftBack;
    case 106:
      return messages.posRightWinger;
    case 107:
      return messages.posRightInnerMidfield;
    case 108:
      return messages.posMiddleInnerMidfield;
    case 109:
      return messages.posLeftInnerMidfield;
    case 110:
      return messages.posLeftWinger;
    case 111:
      return messages.posRightForward;
    case 112:
      return messages.posMiddleForward;
    case 113:
      return messages.posLeftForward;
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
                    match && Number(match.positionCode) === position
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
