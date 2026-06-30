const STORAGE_KEY = 'stx_solitaire_player_profile';

export function createDefaultProfile(walletAddress = '') {
  return {
    walletAddress,
    username: walletAddress ? `Player_${walletAddress.slice(-4)}` : 'Guest',
    xp: 0,
    level: 1,
    gamesPlayed: 0,
    wins: 0,
    currentStreak: 0,
    longestStreak: 0,
    bestTime: null,
    bestMoves: null,
    totalEarned: 0,
    achievements: [],
    lastPlayedAt: null
  };
}

export function xpForLevel(level) {
  return level * level * 100;
}

export function calculateLevel(xp) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) {
    level++;
  }
  return level;
}

export function loadProfile(walletAddress = '') {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProfile(walletAddress);

    const saved = JSON.parse(raw);

    if (walletAddress && saved.walletAddress !== walletAddress) {
      return createDefaultProfile(walletAddress);
    }

    return {
      ...createDefaultProfile(walletAddress),
      ...saved
    };
  } catch {
    return createDefaultProfile(walletAddress);
  }
}

export function saveProfile(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

export function addXP(profile, amount) {
  const nextXP = profile.xp + amount;
  const nextLevel = calculateLevel(nextXP);

  return {
    ...profile,
    xp: nextXP,
    level: nextLevel
  };
}

export function recordGameStart(profile) {
  return saveProfile(addXP({
    ...profile,
    gamesPlayed: profile.gamesPlayed + 1,
    lastPlayedAt: new Date().toISOString()
  }, 5));
}

export function recordWin(profile, stats) {
  let next = {
    ...profile,
    wins: profile.wins + 1,
    currentStreak: profile.currentStreak + 1,
    longestStreak: Math.max(profile.longestStreak, profile.currentStreak + 1),
    bestTime: profile.bestTime === null ? stats.seconds : Math.min(profile.bestTime, stats.seconds),
    bestMoves: profile.bestMoves === null ? stats.moves : Math.min(profile.bestMoves, stats.moves),
    totalEarned: profile.totalEarned + stats.reward
  };

  next = addXP(next, 100);

  if (stats.seconds < 180) {
    next = addXP(next, 50);
    next = addAchievement(next, 'Speed Finisher');
  }

  if (stats.moves < 100) {
    next = addXP(next, 25);
    next = addAchievement(next, 'Efficient Player');
  }

  if (next.wins >= 1) {
    next = addAchievement(next, 'First Win');
  }

  if (next.wins >= 10) {
    next = addAchievement(next, '10 Wins');
  }

  return saveProfile(next);
}

export function addAchievement(profile, achievement) {
  if (profile.achievements.includes(achievement)) return profile;

  return {
    ...profile,
    achievements: [...profile.achievements, achievement]
  };
}

export function formatTime(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
