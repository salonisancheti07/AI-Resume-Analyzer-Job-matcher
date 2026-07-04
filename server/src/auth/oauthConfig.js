const PLACEHOLDER_PATTERN =
  /^(?:change[-_]?this|change[-_]?me|replace[-_]?with|your[-_]|example|placeholder|todo|test|dummy)/i;

export const hasOauthConfig = (...values) =>
  values.every((value) => {
    const normalized = String(value || "").trim();
    return normalized && !PLACEHOLDER_PATTERN.test(normalized);
  });
