const SESSION_KEY = 'stx_solitaire_current_session';
const HISTORY_KEY = 'stx_solitaire_session_history';

export function createSession({ walletAddress = '', mode = 'solo' }) {
  const session = {
    id: `game_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    walletAddress,
    mode,
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    seconds: 0,
    moves: 0,
    score: 0,
    won: false,
    timedOut: false
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function updateSession(patch = {}) {
  const current = loadSession();
  if (!current) return null;

  const next = {
    ...current,
    ...patch
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  return next;
}

export function finishSession({ won = false, timedOut = false, seconds = 0, moves = 0, score = 0 }) {
  const current = loadSession();
  if (!current) return null;

  const finished = {
    ...current,
    status: won ? 'won' : timedOut ? 'timed_out' : 'ended',
    endedAt: new Date().toISOString(),
    seconds,
    moves,
    score,
    won,
    timedOut
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(finished));

  const history = loadHistory();
  history.unshift(finished);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));

  return finished;
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
