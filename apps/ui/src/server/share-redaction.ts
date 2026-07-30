const SHARE_REDACTIONS: Array<[RegExp, string]> = [
  [/```sql[\s\S]*?```/gi, "[redacted SQL]"],
  [/\b(?:sk|sbp|service_role)[-_][A-Za-z0-9._-]{12,}\b/gi, "[redacted credential]"],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted credential]"],
  [
    /\b[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD)\s*[:=]\s*["']?[^\s,"']+["']?/gi,
    "[redacted credential]",
  ],
  [/\b[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-5][A-Fa-f0-9]{3}-[89ABab][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}\b/g, "[redacted identifier]"],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]"],
  [/\b(?:customer|user|account)[_-]id\s*[:=]\s*["']?[A-Za-z0-9_-]+["']?/gi, "[redacted customer identifier]"],
];

/** Defense-in-depth for user-selected public snapshot text. */
export function redactShareText(value: string): string {
  return SHARE_REDACTIONS.reduce(
    (redacted, [pattern, replacement]) => redacted.replace(pattern, replacement),
    value,
  );
}
