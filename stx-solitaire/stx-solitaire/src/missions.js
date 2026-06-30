const MISSIONS_KEY = 'stx_solitaire_daily_missions';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function createDailyMissions() {
  return {
    date: todayKey(),
    missions: [
      {
        id: 'play_one',
        title: 'Play 1 game',
        target: 1,
        progress: 0,
        rewardXP: 20,
        completed: false
      },
      {
        id: 'win_one',
        title: 'Win 1 game',
        target: 1,
        progress: 0,
        rewardXP: 75,
        completed: false
      },
      {
        id: 'under_four_minutes',
        title: 'Finish before 4 minutes',
        target: 1,
        progress: 0,
        rewardXP: 50,
        completed: false
      }
    ]
  };
}

export function loadDailyMissions() {
  try {
    const raw = localStorage.getItem(MISSIONS_KEY);
    if (!raw) {
      const fresh = createDailyMissions();
      saveDailyMissions(fresh);
      return fresh;
    }

    const saved = JSON.parse(raw);

    if (saved.date !== todayKey()) {
      const fresh = createDailyMissions();
      saveDailyMissions(fresh);
      return fresh;
    }

    return saved;
  } catch {
    const fresh = createDailyMissions();
    saveDailyMissions(fresh);
    return fresh;
  }
}

export function saveDailyMissions(data) {
  localStorage.setItem(MISSIONS_KEY, JSON.stringify(data));
  return data;
}

export function progressMission(id, amount = 1) {
  const data = loadDailyMissions();

  data.missions = data.missions.map(m => {
    if (m.id !== id || m.completed) return m;

    const progress = Math.min(m.target, m.progress + amount);

    return {
      ...m,
      progress,
      completed: progress >= m.target
    };
  });

  return saveDailyMissions(data);
}

export function getCompletedMissionRewards(previous, current) {
  const prevMap = new Map(previous.missions.map(m => [m.id, m.completed]));
  return current.missions.filter(m => m.completed && !prevMap.get(m.id));
}
