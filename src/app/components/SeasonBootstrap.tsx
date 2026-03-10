"use client";

import { useEffect } from "react";
import { writeGlobalSeason } from "@/lib/season";

type SeasonBootstrapProps = {
  season: number | null;
};

export default function SeasonBootstrap({ season }: SeasonBootstrapProps) {
  useEffect(() => {
    writeGlobalSeason(season);
  }, [season]);
  return null;
}

