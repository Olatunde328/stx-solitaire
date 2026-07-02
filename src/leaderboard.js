const KEY='stx_solitaire_leaderboard';

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

export function recordGame({
  walletAddress='Guest',
  username='Guest',
  score=0,
  seconds=0,
  moves=0,
  xp=0,
  won=false
}){
  let board=read();

  const existing=board.find(p=>p.walletAddress===walletAddress);

  if(existing){
    existing.games++;
    if(won)existing.wins++;
    existing.score=Math.max(existing.score,score);
    existing.bestTime=existing.bestTime===0?seconds:Math.min(existing.bestTime||seconds,seconds);
    existing.bestMoves=existing.bestMoves===0?moves:Math.min(existing.bestMoves||moves,moves);
    existing.xp=Math.max(existing.xp,xp);
    existing.lastPlayed=new Date().toISOString();
  }else{
    board.push({
      walletAddress,
      username,
      games:1,
      wins:won?1:0,
      score,
      bestTime:seconds,
      bestMoves:moves,
      xp,
      lastPlayed:new Date().toISOString()
    });
  }

  board.sort((a,b)=>{
    if(b.xp!==a.xp)return b.xp-a.xp;
    if(b.score!==a.score)return b.score-a.score;
    return a.bestTime-b.bestTime;
  });

  save(board);
}

export function leaderboard(){
  return read();
}

export function topPlayers(limit=10){
  return read().slice(0,limit);
}
