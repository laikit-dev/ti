export type SidebarAutoBehavior = "overlay" | "push";

export const SIDEBAR_AUTO_BEHAVIOR_STORAGE_KEY = "ti.sidebar.auto-behavior";
export const SIDEBAR_AUTO_BEHAVIOR_CHANGE_EVENT = "ti:sidebar-auto-behavior-change";

export function readSidebarAutoBehavior(): SidebarAutoBehavior {
  try {
    const value = localStorage.getItem(SIDEBAR_AUTO_BEHAVIOR_STORAGE_KEY);
    if (value === "push") return "push";
  } catch {
    // Use the default overlay behavior when local storage is unavailable.
  }
  return "overlay";
}

export function saveSidebarAutoBehavior(behavior: SidebarAutoBehavior) {
  try {
    localStorage.setItem(SIDEBAR_AUTO_BEHAVIOR_STORAGE_KEY, behavior);
  } catch {
    // The custom event still applies the preference to the current page.
  }
  window.dispatchEvent(
    new CustomEvent<SidebarAutoBehavior>(SIDEBAR_AUTO_BEHAVIOR_CHANGE_EVENT, {
      detail: behavior
    })
  );
}
