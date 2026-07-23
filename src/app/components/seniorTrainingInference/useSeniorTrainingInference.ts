"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchChppJson } from "@/lib/chpp/client";
import { mapWithConcurrency } from "@/lib/async";
import { resolveUniqueHighestFootballSkill } from "@/lib/seniorTrainingInference/mainSkill";
import {
  resolveTrainingInferenceFromHistory,
  type SeniorTrainingHistoryInput,
} from "@/lib/seniorTrainingInference/inference";
import type {
  SeniorTrainingInferencePlayerInput,
  SeniorTrainingInferenceState,
} from "@/lib/seniorTrainingInference/types";

const CLIENT_HISTORY_BATCH_SIZE = 4;
const CLIENT_HISTORY_BATCH_CONCURRENCY = 2;

type SeniorTrainingHistoryBatchResponse = {
  players?: Array<
    | ({
        status: "available";
        playerId: number;
        mainSkill: SeniorTrainingHistoryInput extends infer History
          ? History extends { status: "available"; mainSkill: infer Skill }
            ? Skill
            : never
          : never;
        birthdayCutoff: string;
        rawWeightedMinutes: number;
        weeklyCappedMinutes: number;
        equivalentTrainingWeeks: number;
        latestRelevantMatchDate: string | null;
        algorithmVersion: number;
      } & Record<string, unknown>)
    | {
        status: "unavailable";
        playerId: number;
        reason: SeniorTrainingHistoryInput extends infer History
          ? History extends { status: "unavailable"; reason: infer Reason }
            ? Reason
            : never
          : never;
        algorithmVersion: number;
      }
  >;
  error?: string;
  details?: string;
};

function fingerprint(input: SeniorTrainingInferencePlayerInput) {
  const metric = input.metricInput;
  return [
    input.playerId,
    input.currentTeamId ?? "",
    input.currentLeagueId ?? "",
    metric.ageYears,
    metric.ageDays,
    metric.salarySek ?? "",
    metric.tsi ?? "",
    metric.form ?? "",
    metric.stamina ?? "",
    metric.keeper,
    metric.defending,
    metric.playmaking,
    metric.winger,
    metric.passing,
    metric.scoring,
    metric.setPieces,
  ].join("|");
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export function useSeniorTrainingInference(
  players: SeniorTrainingInferencePlayerInput[]
) {
  const generationRef = useRef(0);
  const [statesByPlayerId, setStatesByPlayerId] = useState<
    Record<number, SeniorTrainingInferenceState>
  >({});
  const [visiblePlayerIds, setVisiblePlayerIds] = useState<Set<number>>(
    () => new Set()
  );

  const jobs = useMemo(() => {
    return players.map((player, order) => {
      const mainSkill = resolveUniqueHighestFootballSkill(player.metricInput);
      return {
        player,
        order,
        fingerprint: fingerprint(player),
        mainSkill,
      };
    });
  }, [players]);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let cancelled = false;

    const initialStates: Record<number, SeniorTrainingInferenceState> = {};
    const eligibleJobs = jobs.filter((job) => {
      if (job.mainSkill.status === "incomplete") {
        initialStates[job.player.playerId] = {
          status: "not-applicable",
          reason: "incomplete-skills",
        };
        return false;
      }
      if (job.mainSkill.status === "tie") {
        initialStates[job.player.playerId] = {
          status: "not-applicable",
          reason: "tied-main-skill",
        };
        return false;
      }
      initialStates[job.player.playerId] = {
        status: "loading",
        mainSkill: job.mainSkill.skill,
      };
      return true;
    });
    setStatesByPlayerId(initialStates);

    const orderedJobs = [...eligibleJobs].sort((left, right) => {
      const leftVisible = visiblePlayerIds.has(left.player.playerId) ? 0 : 1;
      const rightVisible = visiblePlayerIds.has(right.player.playerId) ? 0 : 1;
      return leftVisible - rightVisible || left.order - right.order;
    });

    const run = async () => {
      const batches = chunks(orderedJobs, CLIENT_HISTORY_BATCH_SIZE);
      await mapWithConcurrency(
        batches,
        CLIENT_HISTORY_BATCH_CONCURRENCY,
        async (batch) => {
          if (cancelled) return;
          try {
            const { response, payload } =
              await fetchChppJson<SeniorTrainingHistoryBatchResponse>(
                "/api/chpp/senior-training-history",
                {
                  method: "POST",
                  cache: "no-store",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    players: batch.map((job) => ({
                      playerId: job.player.playerId,
                      ageYears: job.player.metricInput.ageYears,
                      ageDays: job.player.metricInput.ageDays,
                      mainSkill:
                        job.mainSkill.status === "unique"
                          ? job.mainSkill.skill
                          : null,
                      currentTeamId: job.player.currentTeamId ?? null,
                      currentLeagueId: job.player.currentLeagueId ?? null,
                    })),
                  }),
                }
              );
            if (!response.ok || payload?.error) {
              throw new Error(payload?.details ?? payload?.error ?? "request failed");
            }
            const histories = new Map<number, SeniorTrainingHistoryInput>();
            for (const result of payload?.players ?? []) {
              if (result.status === "available") {
                histories.set(result.playerId, {
                  status: "available",
                  playerId: result.playerId,
                  mainSkill: result.mainSkill,
                  birthdayCutoff: result.birthdayCutoff,
                  rawWeightedMinutes: result.rawWeightedMinutes,
                  weeklyCappedMinutes: result.weeklyCappedMinutes,
                  equivalentTrainingWeeks: result.equivalentTrainingWeeks,
                  latestRelevantMatchDate: result.latestRelevantMatchDate,
                  algorithmVersion: result.algorithmVersion,
                });
              } else if (result.status === "unavailable") {
                histories.set(result.playerId, {
                  status: "unavailable",
                  reason: result.reason,
                });
              }
            }
            if (cancelled || generationRef.current !== generation) return;
            setStatesByPlayerId((current) => {
              const next = { ...current };
              for (const job of batch) {
                const latestJob = jobs.find(
                  (candidate) => candidate.player.playerId === job.player.playerId
                );
                if (!latestJob || latestJob.fingerprint !== job.fingerprint) {
                  continue;
                }
                const history = histories.get(job.player.playerId);
                next[job.player.playerId] = history
                  ? resolveTrainingInferenceFromHistory({
                      playerId: job.player.playerId,
                      metricInput: job.player.metricInput,
                      history,
                    })
                  : { status: "unavailable", reason: "request-failed" };
              }
              return next;
            });
          } catch {
            if (cancelled || generationRef.current !== generation) return;
            setStatesByPlayerId((current) => {
              const next = { ...current };
              for (const job of batch) {
                next[job.player.playerId] = {
                  status: "unavailable",
                  reason: "request-failed",
                };
              }
              return next;
            });
          }
        }
      );
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [jobs, visiblePlayerIds]);

  const progress = useMemo(() => {
    const eligibleIds = jobs
      .filter((job) => job.mainSkill.status === "unique")
      .map((job) => job.player.playerId);
    if (eligibleIds.length === 0) return null;
    const completed = eligibleIds.filter((playerId) => {
      const state = statesByPlayerId[playerId];
      return state?.status === "available" || state?.status === "unavailable";
    }).length;
    return completed < eligibleIds.length
      ? { completed, total: eligibleIds.length }
      : null;
  }, [jobs, statesByPlayerId]);

  return {
    statesByPlayerId,
    progress,
    registerVisiblePlayer: (playerId: number, visible: boolean) => {
      setVisiblePlayerIds((current) => {
        const next = new Set(current);
        if (visible) next.add(playerId);
        else next.delete(playerId);
        return next;
      });
    },
    invalidatePlayer: (playerId: number) => {
      setStatesByPlayerId((current) => {
        const next = { ...current };
        delete next[playerId];
        return next;
      });
    },
  };
}

