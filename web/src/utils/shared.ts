/**
 * Shared utility functions used across multiple components.
 * Extracted to avoid duplication.
 */

/** Normalize option-style answer (e.g. "a, c" → "A,C"). */
export function normalizeOptionAnswer(raw: string): string {
    return Array.from(
        new Set(
            String(raw ?? "")
                .split(",")
                .map((item) => item.trim().toUpperCase())
                .filter((item) => /^[A-Z]$/.test(item))
        )
    )
        .sort()
        .join(",");
}

export function isMultipleQuestion(answer: string): boolean {
    return normalizeOptionAnswer(answer).includes(",");
}

/** Format an ISO date string as "yyyy-MM-dd HH:mm". */
export function formatDate(value: string | null | undefined): string {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

const LOCAL_SESSION_KEY = "ti.session";

export function saveBearerSession(token: string): void {
    localStorage.setItem(LOCAL_SESSION_KEY, String(token ?? "").trim());
}

export function loadBearerSession(): string {
    return String(localStorage.getItem(LOCAL_SESSION_KEY) ?? "").trim();
}

export function clearBearerSession(): void {
    localStorage.removeItem(LOCAL_SESSION_KEY);
}

/** Build the server-verifiable Authorization header for authenticated API calls. */
export function userAuthHeaders(): Record<string, string> {
    const token = loadBearerSession();
    return token ? { Authorization: `Bearer ${token}` } : {};
}
