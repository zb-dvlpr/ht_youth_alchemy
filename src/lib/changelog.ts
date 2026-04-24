import type { Messages } from "./i18n";

type ChangelogKey =
  | "changelog_4_11_0"
  | "changelog_4_10_0"
  | "changelog_4_9_0"
  | "changelog_4_8_0"
  | "changelog_4_7_0"
  | "changelog_4_6_0"
  | "changelog_4_5_0"
  | "changelog_4_4_0"
  | "changelog_4_3_0"
  | "changelog_4_2_0"
  | "changelog_4_1_0"
  | "changelog_4_0_0"
  | "changelog_3_13_0"
  | "changelog_3_12_0"
  | "changelog_3_11_0"
  | "changelog_3_10_0"
  | "changelog_3_9_0"
  | "changelog_3_8_0"
  | "changelog_3_7_0"
  | "changelog_3_6_0"
  | "changelog_3_5_0"
  | "changelog_3_4_0"
  | "changelog_3_3_0"
  | "changelog_3_2_0"
  | "changelog_3_1_0"
  | "changelog_3_0_0"
  | "changelog_2_24_0"
  | "changelog_2_23_0"
  | "changelog_2_22_0"
  | "changelog_2_21_0"
  | "changelog_2_20_0"
  | "changelog_2_19_0"
  | "changelog_2_18_0"
  | "changelog_2_17_0"
  | "changelog_2_16_0"
  | "changelog_2_15_0"
  | "changelog_2_14_0"
  | "changelog_2_13_0"
  | "changelog_2_12_0"
  | "changelog_2_11_0"
  | "changelog_2_10_0"
  | "changelog_2_9_0"
  | "changelog_2_8_0"
  | "changelog_2_7_0"
  | "changelog_2_6_0"
  | "changelog_2_5_0"
  | "changelog_2_4_0"
  | "changelog_2_3_0"
  | "changelog_2_2_0"
  | "changelog_2_1_0"
  | "changelog_2_0_0"
  | "changelog_1_28_0"
  | "changelog_1_26_0"
  | "changelog_1_25_0"
  | "changelog_1_24_0"
  | "changelog_1_23_0"
  | "changelog_1_22_0"
  | "changelog_1_21_0"
  | "changelog_1_19_0";

const CHANGELOG_DEFINITIONS: ReadonlyArray<{
  version: string;
  key: ChangelogKey;
}> = [
  { version: "4.11.0", key: "changelog_4_11_0" },
  { version: "4.10.0", key: "changelog_4_10_0" },
  { version: "4.9.0", key: "changelog_4_9_0" },
  { version: "4.8.0", key: "changelog_4_8_0" },
  { version: "4.7.0", key: "changelog_4_7_0" },
  { version: "4.6.0", key: "changelog_4_6_0" },
  { version: "4.5.0", key: "changelog_4_5_0" },
  { version: "4.4.0", key: "changelog_4_4_0" },
  { version: "4.3.0", key: "changelog_4_3_0" },
  { version: "4.2.0", key: "changelog_4_2_0" },
  { version: "4.1.0", key: "changelog_4_1_0" },
  { version: "4.0.0", key: "changelog_4_0_0" },
  { version: "3.13.0", key: "changelog_3_13_0" },
  { version: "3.12.0", key: "changelog_3_12_0" },
  { version: "3.11.0", key: "changelog_3_11_0" },
  { version: "3.10.0", key: "changelog_3_10_0" },
  { version: "3.9.0", key: "changelog_3_9_0" },
  { version: "3.8.0", key: "changelog_3_8_0" },
  { version: "3.7.0", key: "changelog_3_7_0" },
  { version: "3.6.0", key: "changelog_3_6_0" },
  { version: "3.5.0", key: "changelog_3_5_0" },
  { version: "3.4.0", key: "changelog_3_4_0" },
  { version: "3.3.0", key: "changelog_3_3_0" },
  { version: "3.2.0", key: "changelog_3_2_0" },
  { version: "3.1.0", key: "changelog_3_1_0" },
  { version: "3.0.0", key: "changelog_3_0_0" },
  { version: "2.24.0", key: "changelog_2_24_0" },
  { version: "2.23.0", key: "changelog_2_23_0" },
  { version: "2.22.0", key: "changelog_2_22_0" },
  { version: "2.21.0", key: "changelog_2_21_0" },
  { version: "2.20.0", key: "changelog_2_20_0" },
  { version: "2.19.0", key: "changelog_2_19_0" },
  { version: "2.18.0", key: "changelog_2_18_0" },
  { version: "2.17.0", key: "changelog_2_17_0" },
  { version: "2.16.0", key: "changelog_2_16_0" },
  { version: "2.15.0", key: "changelog_2_15_0" },
  { version: "2.14.0", key: "changelog_2_14_0" },
  { version: "2.13.0", key: "changelog_2_13_0" },
  { version: "2.12.0", key: "changelog_2_12_0" },
  { version: "2.11.0", key: "changelog_2_11_0" },
  { version: "2.10.0", key: "changelog_2_10_0" },
  { version: "2.9.0", key: "changelog_2_9_0" },
  { version: "2.8.0", key: "changelog_2_8_0" },
  { version: "2.7.0", key: "changelog_2_7_0" },
  { version: "2.6.0", key: "changelog_2_6_0" },
  { version: "2.5.0", key: "changelog_2_5_0" },
  { version: "2.4.0", key: "changelog_2_4_0" },
  { version: "2.3.0", key: "changelog_2_3_0" },
  { version: "2.2.0", key: "changelog_2_2_0" },
  { version: "2.1.0", key: "changelog_2_1_0" },
  { version: "2.0.0", key: "changelog_2_0_0" },
  { version: "1.28.0", key: "changelog_1_28_0" },
  { version: "1.26.0", key: "changelog_1_26_0" },
  { version: "1.25.0", key: "changelog_1_25_0" },
  { version: "1.24.0", key: "changelog_1_24_0" },
  { version: "1.23.0", key: "changelog_1_23_0" },
  { version: "1.22.0", key: "changelog_1_22_0" },
  { version: "1.21.0", key: "changelog_1_21_0" },
  { version: "1.19.0", key: "changelog_1_19_0" },
];

export function getChangelogEntries(messages: Messages) {
  return CHANGELOG_DEFINITIONS.map(({ version, key }) => ({
    version,
    entries: [messages[key]],
  }));
}
