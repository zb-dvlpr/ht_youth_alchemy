import { Messages } from "@/lib/i18n";
import {
  calculateSeniorPlayerMetrics,
  type PsicoTsiMetrics,
  type SeniorPlayerMetricInput,
  type SeniorPlayerMetricSkills,
} from "@/lib/seniorPlayerMetrics";
import type { SeniorTrainingInferenceState } from "@/lib/seniorTrainingInference/types";
import styles from "../page.module.css";
import Tooltip from "./Tooltip";

type SeniorFoxtrickMetricsProps = {
  input: SeniorPlayerMetricInput;
  messages: Messages;
  trainingInference?: SeniorTrainingInferenceState;
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

const formatInferredSkill = (value: number) => value.toFixed(2);

const replaceTemplate = (
  template: string,
  replacements: Record<string, string>
) =>
  Object.entries(replacements).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template
  );

const renderInflationWarning = (
  inflated: boolean,
  messages: Messages
) =>
  inflated ? (
    <Tooltip content={messages.seniorTrainingInferencePossiblyInflatedTooltip}>
      <span className={styles.seniorTrainingInflatedWarning}>
        {messages.seniorTrainingInferencePossiblyInflated}
      </span>
    </Tooltip>
  ) : null;

function renderInferenceCell(
  state: SeniorTrainingInferenceState | undefined,
  row: "high" | "average" | "low",
  messages: Messages
) {
  if (!state || state.status === "idle") return "—";
  if (state.status === "loading") {
    return (
      <span className={styles.seniorTrainingInferenceLoading}>
        <span className={styles.inlineSpinner} aria-hidden="true" />
        <span>{messages.seniorTrainingInferenceCalculating}</span>
      </span>
    );
  }
  if (state.status === "not-applicable") {
    return (
      <Tooltip content={messages.seniorTrainingInferenceNotApplicableTooltip}>
        <span>{messages.seniorTrainingInferenceNotApplicable}</span>
      </Tooltip>
    );
  }
  if (state.status === "unavailable") {
    const reason =
      state.reason === "wage-prediction-unavailable"
        ? messages.seniorTrainingInferenceUnavailableWage
        : state.reason === "timeline-unavailable" ||
            state.reason === "lineup-unavailable" ||
            state.reason === "team-history-unavailable" ||
            state.reason === "match-history-unavailable"
          ? messages.seniorTrainingInferenceUnavailableHistory
          : messages.seniorTrainingInferenceUnavailable;
    return (
      <Tooltip content={reason}>
        <span>{messages.seniorTrainingInferenceUnavailable}</span>
      </Tooltip>
    );
  }
  const value =
    row === "high"
      ? state.inferredHigh
      : row === "average"
        ? state.inferredAverage
        : state.inferredLow;
  return formatInferredSkill(value);
}

function buildInferenceTooltip(
  state: SeniorTrainingInferenceState | undefined,
  skillLabel: string,
  messages: Messages
) {
  if (state?.status !== "available") {
    return messages.seniorTrainingInferenceTableTooltip;
  }
  const weeks = state.equivalentTrainingWeeks.toFixed(2);
  if (state.weeklyCappedMinutes === 0) {
    return replaceTemplate(messages.seniorTrainingInferenceZeroMinutesTooltip, {
      skill: skillLabel,
      weeks,
    });
  }
  return replaceTemplate(messages.seniorTrainingInferenceTooltip, {
    skill: skillLabel,
    weeks,
  });
}

export default function SeniorFoxtrickMetrics({
  input,
  messages,
  trainingInference,
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
                <th colSpan={6}>
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
                <th colSpan={2}>
                  <Tooltip
                    content={buildInferenceTooltip(
                      trainingInference,
                      messages[
                        skillLabelKeyByMetricSkill[metrics.psicoTsi.mainSkill]
                      ] as string,
                      messages
                    )}
                  >
                    <span>{messages.seniorTrainingInferenceGroupLabel}</span>
                  </Tooltip>
                </th>
              </tr>
              <tr>
                <th>{messages.seniorPsicoTsiFormSublevelsLabel}</th>
                <th>{messages.seniorPsicoTsiPredictionLabel}</th>
                <th>{messages.seniorPsicoTsiSecondariesSublevelsLabel}</th>
                <th>{messages.seniorPsicoTsiPredictionLabel}</th>
                <th>{messages.seniorPsicoTsiSecondariesSublevelsLabel}</th>
                <th>{messages.seniorTrainingInferenceValueLabel}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{messages.seniorPsicoTsiHighLabel}</td>
                <td>
                  {metrics.psicoTsi.formHigh}{" "}
                  {renderInflationWarning(
                    trainingInference?.status === "available" &&
                      trainingInference.tsiHighPossiblyInflated,
                    messages
                  )}
                </td>
                <td>{messages.seniorPsicoTsiHighLabel}</td>
                <td>{metrics.psicoTsi.wageHigh}</td>
                <td>{messages.seniorPsicoTsiHighLabel}</td>
                <td>{renderInferenceCell(trainingInference, "high", messages)}</td>
              </tr>
              <tr>
                <td>{messages.seniorPsicoTsiAverageLabel}</td>
                <td>
                  {metrics.psicoTsi.formAvg}{" "}
                  {renderInflationWarning(
                    trainingInference?.status === "available" &&
                      trainingInference.tsiAveragePossiblyInflated,
                    messages
                  )}
                </td>
                <td>{messages.seniorPsicoTsiAverageLabel}</td>
                <td>{metrics.psicoTsi.wageAvg}</td>
                <td>{messages.seniorPsicoTsiAverageLabel}</td>
                <td>{renderInferenceCell(trainingInference, "average", messages)}</td>
              </tr>
              <tr>
                <td>{messages.seniorPsicoTsiLowLabel}</td>
                <td>
                  {metrics.psicoTsi.formLow}{" "}
                  {renderInflationWarning(
                    trainingInference?.status === "available" &&
                      trainingInference.tsiLowPossiblyInflated,
                    messages
                  )}
                </td>
                <td>{messages.seniorPsicoTsiLowLabel}</td>
                <td>{metrics.psicoTsi.wageLow}</td>
                <td>{messages.seniorPsicoTsiLowLabel}</td>
                <td>{renderInferenceCell(trainingInference, "low", messages)}</td>
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
