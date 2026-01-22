import styles from "../page.module.css";

const POSITION_ROWS = [
  { positions: ["KP"], className: "fieldRowGoal" },
  { positions: ["WB", "CD", "CD", "CD", "WB"], className: "fieldRowDef" },
  { positions: ["W", "IM", "IM", "IM", "W"], className: "fieldRowMid" },
  { positions: ["F", "F", "F"], className: "fieldRowAtk" },
];

export default function LineupField() {
  return (
    <div className={styles.fieldCard}>
      <div className={styles.fieldHeader}>Lineup</div>
      <div className={styles.fieldPitch}>
        <div className={styles.penaltyBox} />
        <div className={styles.penaltyArc} />
        <div className={styles.fieldGoal}>
          <div className={styles.fieldGoalNet} />
        </div>
        {POSITION_ROWS.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`${styles.fieldRow} ${styles[row.className]}`}
          >
            {row.positions.map((position, index) => (
              <div key={`${position}-${index}`} className={styles.fieldSlot}>
                <span className={styles.fieldLabel}>{position}</span>
              </div>
            ))}
          </div>
        ))}
        <div className={styles.centerCircle} />
        <div className={styles.centerSpot} />
      </div>
    </div>
  );
}
