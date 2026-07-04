const TOKEN_KEY = "token";
const USER_KEY = "user";
const REMEMBER_KEY = "remember_me";
const SESSION_VERSION_KEY = "auth_session_version";
const CURRENT_SESSION_VERSION = "3";

const getPreferredStorage = () =>
  localStorage.getItem(REMEMBER_KEY) === "true" ? localStorage : sessionStorage;

const read = (key) => localStorage.getItem(key) || sessionStorage.getItem(key);
const hasValidUserShape = (user) => Boolean(user && typeof user === "object" && (user.email || user.id || user.name));
const isLikelyJwt = (token) => Boolean(typeof token === "string" && token.split(".").length === 3);

const clearStoredSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  localStorage.removeItem(SESSION_VERSION_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
};

const normalizeLegacySession = () => {
  const storedVersion = localStorage.getItem(SESSION_VERSION_KEY);
  if (storedVersion !== CURRENT_SESSION_VERSION) {
    clearStoredSession();
    return;
  }
  const token = read(TOKEN_KEY);
  if (token && !isLikelyJwt(token)) {
    clearStoredSession();
  }
};

normalizeLegacySession();

export const auth = {
  getToken: () => {
    const token = read(TOKEN_KEY);
    return isLikelyJwt(token) ? token : null;
  },
  getUser: () => {
    if (!auth.getToken()) return null;
    const raw = read(USER_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return hasValidUserShape(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },
  setSession: (token, user, options = {}) => {
    const rememberMe = Boolean(options.rememberMe);
    clearStoredSession();
    localStorage.setItem(REMEMBER_KEY, String(rememberMe));
    localStorage.setItem(SESSION_VERSION_KEY, CURRENT_SESSION_VERSION);
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    clearStoredSession();
  },
  isAuthed: () => {
    const token = auth.getToken();
    const user = auth.getUser();
    return Boolean(token && user);
  },
  persistPreference: () => getPreferredStorage(),
};
