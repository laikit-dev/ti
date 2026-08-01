export type SubmissionAnalysisMode = "none" | "wrong_only" | "all";

const SUBMISSION_ANALYSIS_MODE_KEY = "ti.settings.submission-analysis-mode";
const HIGHLIGHTER_ENABLED_KEY = "ti.settings.highlighter-enabled";

export function readSubmissionAnalysisMode(): SubmissionAnalysisMode {
  try {
    const value = localStorage.getItem(SUBMISSION_ANALYSIS_MODE_KEY);
    if (value === "none" || value === "wrong_only" || value === "all") return value;
  } catch {
    // Use the default when local storage is unavailable.
  }
  return "wrong_only";
}

export function readHighlighterEnabled(): boolean {
  try {
    const value = localStorage.getItem(HIGHLIGHTER_ENABLED_KEY);
    if (value === "false") return false;
    if (value === "true") return true;
  } catch {
    // Use the default when local storage is unavailable.
  }
  return true;
}

export function saveDeviceContentPreferences(
  submissionAnalysisMode: SubmissionAnalysisMode,
  highlighterEnabled: boolean
) {
  try {
    localStorage.setItem(SUBMISSION_ANALYSIS_MODE_KEY, submissionAnalysisMode);
    localStorage.setItem(HIGHLIGHTER_ENABLED_KEY, String(highlighterEnabled));
  } catch {
    // Keep the selected values in memory when local storage is unavailable.
  }
}
