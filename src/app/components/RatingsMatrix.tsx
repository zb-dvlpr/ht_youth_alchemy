import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { POSITION_COLUMNS, positionLabel } from "@/lib/positions";

type RatingRow = {
  id: number;
  name: string;
  ratings: Record<string, number>;
};

export type RatingsMatrixResponse = {
  positions: number[];
  players: RatingRow[];
};

type RatingsMatrixProps = {
  response: RatingsMatrixResponse | null;
  messages: Messages;
};

function uniquePositions(positions: number[] | undefined) {
  if (!positions || positions.length === 0) return POSITION_COLUMNS;
  return POSITION_COLUMNS.filter((code) => positions.includes(code));
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
