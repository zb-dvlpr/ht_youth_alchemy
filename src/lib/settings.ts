export const ALGORITHM_SETTINGS_STORAGE_KEY = "ya_allow_training_until_maxed_out_v1";
export const ALGORITHM_SETTINGS_EVENT = "ya:algorithm-settings";
export const DEFAULT_ALLOW_TRAINING_UNTIL_MAXED_OUT = true;

export function readAllowTrainingUntilMaxedOut(): boolean {
  if (typeof window === "undefined") {
    return DEFAULT_ALLOW_TRAINING_UNTIL_MAXED_OUT;
  }
  try {
    const stored = window.localStorage.getItem(ALGORITHM_SETTINGS_STORAGE_KEY);
    if (stored === null) {
      return DEFAULT_ALLOW_TRAINING_UNTIL_MAXED_OUT;
    }
    return stored === "true";
  } catch {
    return DEFAULT_ALLOW_TRAINING_UNTIL_MAXED_OUT;
  }
}

export function writeAllowTrainingUntilMaxedOut(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ALGORITHM_SETTINGS_STORAGE_KEY,
      value ? "true" : "false"
    );
  } catch {
    // ignore storage errors
  }
}
