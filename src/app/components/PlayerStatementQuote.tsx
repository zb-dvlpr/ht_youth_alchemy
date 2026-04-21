import styles from "../page.module.css";

type PlayerStatementQuoteProps = {
  statement?: string | null;
};

export default function PlayerStatementQuote({ statement }: PlayerStatementQuoteProps) {
  const trimmed = typeof statement === "string" ? statement.trim() : "";
  if (!trimmed) return null;

  return <blockquote className={styles.playerStatementQuote}>{trimmed}</blockquote>;
}
