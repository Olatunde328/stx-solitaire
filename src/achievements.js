const KEY='stx_solitaire_achievements';

export const ACHIEVEMENTS=[
  {
    id:'first_win',
    title:'First Win',
    icon:'🥇',
    description:'Win your first game.'
  },
  {
    id:'speed_runner',
    title:'Speed Runner',
    icon:'⚡',
    description:'Win under 2 minutes.'
  },
  {
    id:'efficient_player',
    title:'Efficient Player',
    icon:'🎯',
    description:'Win with fewer than 80 moves.'
  },
  {
    id:'streak_3',
    title:'Hot Streak',
    icon:'🔥',
    description:'Reach a 3-win streak.'
  },
  {
    id:'veteran',
    title:'Veteran',
    icon:'🛡️',
    description:'Play 25 games.'
  },
  {
    id:'legend',
    title:'Legend',
    icon:'👑',
    description:'Win 100 games.'
  }
];

function read(){
  try{
    return JSON.parse(localStorage.getItem(KEY)||'[]');
  }catch{
    return [];
  }
}

function save(data){
  localStorage.setItem(KEY,JSON.stringify(data));
}

export function unlockedAchievements(){
  return read();
}

export function unlockAchievement(id){
  const current=read();
  if(current.includes(id))return null;

  current.push(id);
  save(current);

  return ACHIEVEMENTS.find(a=>a.id===id)||null;
}

export function evaluateAchievements(profile,{won=false,seconds=0,moves=0}={}){
  const newly=[];

  if(won && profile.wins>=1){
    const a=unlockAchievement('first_win');
    if(a)newly.push(a);
  }

  if(won && seconds>0 && seconds<120){
    const a=unlockAchievement('speed_runner');
    if(a)newly.push(a);
  }

  if(won && moves>0 && moves<80){
    const a=unlockAchievement('efficient_player');
    if(a)newly.push(a);
  }

  if(profile.currentStreak>=3){
    const a=unlockAchievement('streak_3');
    if(a)newly.push(a);
  }

  if(profile.gamesPlayed>=25){
    const a=unlockAchievement('veteran');
    if(a)newly.push(a);
  }

  if(profile.wins>=100){
    const a=unlockAchievement('legend');
    if(a)newly.push(a);
  }

  return newly;
}

export function achievementById(id){
  return ACHIEVEMENTS.find(a=>a.id===id);
}
