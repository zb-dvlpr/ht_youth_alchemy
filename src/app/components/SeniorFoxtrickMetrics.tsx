import { Messages } from "@/lib/i18n";
import {
  calculateSeniorPlayerMetrics,
  type PsicoTsiMetrics,
  type SeniorPlayerMetricInput,
  type SeniorPlayerMetricSkills,
} from "@/lib/seniorPlayerMetrics";
import styles from "../page.module.css";

type SeniorFoxtrickMetricsProps = {
  input: SeniorPlayerMetricInput;
  messages: Messages;
};

const skillLabelKeyByMetricSkill: Record<keyof SeniorPlayerMetricSkills, keyof Messages> = {
  keeper: "skillKeeper",
  defending: "skillDefending",
  playmaking: "skillPlaymaking",
  winger: "skillWinger",
  passing: "skillPassing",
  scoring: "skillScoring",
  setPieces: "skillSetPieces",
  stamina: "sortStamina",
  form: "sortForm",
};

const hasWagePrediction = (psicoTsi: PsicoTsiMetrics) =>
  psicoTsi.wageLow !== "N/A" &&
  psicoTsi.wageAvg !== "N/A" &&
  psicoTsi.wageHigh !== "N/A";

const htmsPotentialPillClassName = (potential: number) => {
  if (potential < 1900) return styles.htmsPotentialLow;
  if (potential < 2000) return styles.htmsPotentialMedium;
  if (potential <= 2100) return styles.htmsPotentialHigh;
  return styles.htmsPotentialElite;
};

export default function SeniorFoxtrickMetrics({
  input,
  messages,
}: SeniorFoxtrickMetricsProps) {
  const metrics = calculateSeniorPlayerMetrics(input);
  if (!metrics.htms && !metrics.psicoTsi) return null;

  return (
    <section className={styles.seniorFoxtrickMetrics}>
      <div className={styles.sectionHeadingRow}>
        <h5 className={styles.sectionHeading}>
          <a
            className={styles.seniorFoxtrickMetricsLink}
            href="https://foxtrick-ng.github.io/"
            target="_blank"
            rel="noreferrer"
          >
            {messages.seniorFoxtrickMetricsTitle}
          </a>
        </h5>
      </div>
      {metrics.htms ? (
        <div className={styles.profileInfoRow}>
          <div>
            <div className={styles.infoLabel}>{messages.seniorHtmsAbilityLabel}</div>
            <div className={styles.infoValue}>{metrics.htms.ability}</div>
          </div>
          <div>
            <div className={styles.infoLabel}>{messages.seniorHtmsPotentialLabel}</div>
            <div className={styles.infoValue}>
              <span
                className={`${styles.htmsPotentialPill} ${htmsPotentialPillClassName(
                  metrics.htms.potential
                )}`}
              >
                {metrics.htms.potential}
              </span>
            </div>
          </div>
        </div>
      ) : null}
      {metrics.psicoTsi ? (
        <div className={styles.seniorPsicoTableWrap}>
          <table className={styles.seniorPsicoTable}>
            <thead>
              <tr>
                <th colSpan={4}>
                  {messages.seniorPsicoTsiMainSkillLabel}:{" "}
                  {
                    messages[
                      skillLabelKeyByMetricSkill[metrics.psicoTsi.mainSkill]
                    ] as string
                  }
                </th>
              </tr>
              <tr>
                <th colSpan={2}>{messages.seniorPsicoTsiTsiPredictionLabel}</th>
                <th colSpan={2}>{messages.seniorPsicoTsiWagePredictionLabel}</th>
              </tr>
              <tr>
                <th>{messages.seniorPsicoTsiFormSublevelsLabel}</th>
                <th>{messages.seniorPsicoTsiPredictionLabel}</th>
                <th>{messages.seniorPsicoTsiSecondariesSublevelsLabel}</th>
                <th>{messages.seniorPsicoTsiPredictionLabel}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{messages.seniorPsicoTsiHighLabel}</td>
                <td>{metrics.psicoTsi.formHigh}</td>
                <td>{messages.seniorPsicoTsiHighLabel}</td>
                <td>{metrics.psicoTsi.wageHigh}</td>
              </tr>
              <tr>
                <td>{messages.seniorPsicoTsiAverageLabel}</td>
                <td>{metrics.psicoTsi.formAvg}</td>
                <td>{messages.seniorPsicoTsiAverageLabel}</td>
                <td>{metrics.psicoTsi.wageAvg}</td>
              </tr>
              <tr>
                <td>{messages.seniorPsicoTsiLowLabel}</td>
                <td>{metrics.psicoTsi.formLow}</td>
                <td>{messages.seniorPsicoTsiLowLabel}</td>
                <td>{metrics.psicoTsi.wageLow}</td>
              </tr>
            </tbody>
          </table>
          <div className={styles.seniorPsicoWarnings}>
            {metrics.psicoTsi.undefinedMainSkill ? (
              <span>{messages.seniorPsicoTsiUndefinedMainSkillWarning}</span>
            ) : null}
            {metrics.psicoTsi.isGoalkeeper || !hasWagePrediction(metrics.psicoTsi) ? (
              <span>{messages.seniorPsicoTsiWageUnavailableWarning}</span>
            ) : null}
            {metrics.psicoTsi.limit === "Low" ? (
              <span>{messages.seniorPsicoTsiLowSublevelsWarning}</span>
            ) : null}
            {metrics.psicoTsi.limit === "High" ? (
              <span>{messages.seniorPsicoTsiHighSublevelsWarning}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
