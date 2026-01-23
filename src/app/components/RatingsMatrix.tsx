import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";

type RatingRow = {
  id: number;
  name: string;
  ratings: Record<string, number>;
};

type RatingsMatrixResponse = {
  positions: number[];
  players: RatingRow[];
};

type RatingsMatrixProps = {
  response: RatingsMatrixResponse | null;
  messages: Messages;
};

const POSITION_ORDER = [100, 101, 103, 106, 107, 111];

function uniquePositions(positions: number[] | undefined) {
  if (!positions || positions.length === 0) return POSITION_ORDER;
  return POSITION_ORDER.filter((code) => positions.includes(code));
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

  const positions = uniquePositions(response.positions);

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>{messages.ratingsTitle}</h2>
      <div className={styles.matrixWrapper}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th />
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
                  const rating = row.ratings[String(position)] ?? null;
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
