import { showConnect, UserSession, AppConfig } from '@stacks/connect';
import { StacksTestnet } from '@stacks/network';
import { makeContractCall, AnchorMode, PostConditionMode, uintCV, boolCV } from '@stacks/transactions';
import { loadProfile, saveProfile, recordGameStart, recordWin, formatTime } from './player.js';
import { createSession, updateSession, finishSession, loadSession, loadHistory } from './session.js';
import { loadDailyMissions, progressMission, getCompletedMissionRewards } from './missions.js';

const appConfig = new AppConfig(['store_write','publish_data']);
const userSession = new UserSession({ appConfig });
const network = new StacksTestnet();
const CONTRACT_ADDRESS = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const CONTRACT_NAME = 'solitaire-rewards';

function connectWallet(cb){showConnect({appDetails:{name:'STX Solitaire',icon:window.location.origin+'/favicon.ico'},redirectTo:'/',onFinish:()=>cb(userSession.loadUserData()),userSession});}
function isSignedIn(){return userSession.isUserSignedIn();}
function getUser(){return isSignedIn()?userSession.loadUserData():null;}
function signOut(){userSession.signUserOut('/');}
async function claimRewardOnChain(score,fast,efficient,onSuccess,onError){if(!isSignedIn())return onError('Not signed in');try{await makeContractCall({contractAddress:CONTRACT_ADDRESS,contractName:CONTRACT_NAME,functionName:'claim-reward',functionArgs:[uintCV(score),boolCV(fast),boolCV(efficient)],network,anchorMode:AnchorMode.Any,postConditionMode:PostConditionMode.Allow,onFinish:d=>onSuccess(d.txId),onCancel:()=>onError('Cancelled')});}catch(e){onError(e.message);}}

const SUITS=['♠','♥','♦','♣'],SUIT_CLR={'♠':'black','♣':'black','♥':'red','♦':'red'},VALUES=['A','2','3','4','5','6','7','8','9','10','J','Q','K'],VAL_NUM={};
VALUES.forEach((v,i)=>VAL_NUM[v]=i+1);
let stock=[],waste=[],foundations=[[],[],[],[]],tableau=[[],[],[],[],[],[],[]];
let moves=0,score=0,seconds=0,timerInterval=null,gameActive=false,totalEarned=0,_fastWin=false,_efficient=false;
let gameMode='solo';
const MAX_GAME_SECONDS=240;
let robotProgress=0;
let robotFinishTime=0;
let robotHasFinished=false;
let currentMatchId=null;
let invitedMatchId=null;
let currentSession=null;
let sel=null; // {card, sType, sIdx, cIdx}
let playerProfile=null;

function buildDeck(){const d=[];SUITS.forEach(s=>VALUES.forEach(v=>d.push({suit:s,val:v,face:false})));return d;}
function shuffle(d){for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}return d;}

function newGame(){
  clearInterval(timerInterval);
  moves=0;score=0;seconds=0;gameActive=true;sel=null;_fastWin=false;_efficient=false;
  foundations=[[],[],[],[]];tableau=[[],[],[],[],[],[],[]];waste=[];
  if(gameMode==='robot')setupRobotOpponent();else updateOpponentUI();
  const deck=shuffle(buildDeck());let idx=0;
  for(let col=0;col<7;col++)for(let row=0;row<=col;row++){const c={...deck[idx++]};c.face=(row===col);tableau[col].push(c);}
  stock=deck.slice(idx).map(c=>({...c,face:false}));
  const beforeMissionPlay=loadDailyMissions();
  const afterMissionPlay=progressMission('play_one',1);
  awardCompletedMissions(beforeMissionPlay,afterMissionPlay);
  const walletAddr=playerProfile?.walletAddress||'';
  currentSession=createSession({walletAddress:walletAddr,mode:gameMode});
  updateSession({seconds,moves,score});
  if(playerProfile){playerProfile=recordGameStart(playerProfile);updateProfileUI();}
  updateStats();render();
  timerInterval=setInterval(()=>{seconds++;updateStats();robotTick();if(seconds>=MAX_GAME_SECONDS&&gameActive){endGameTimeout();}},1000);
}

function updateProfileUI(){
  updateHistoryUI();
  updateMissionsUI();
  if(!playerProfile)return;
  const el=document.getElementById('profileCard');
  if(!el)return;
  const activeSession=loadSession();
  el.innerHTML=`<div class="profile-title">Player Profile</div>
    <div class="profile-row"><span>Level</span><strong>${playerProfile.level}</strong></div>
    <div class="profile-row"><span>XP</span><strong>${playerProfile.xp}</strong></div>
    <div class="profile-row"><span>Games</span><strong>${playerProfile.gamesPlayed}</strong></div>
    <div class="profile-row"><span>Wins</span><strong>${playerProfile.wins}</strong></div>
    <div class="profile-row"><span>Streak</span><strong>${playerProfile.currentStreak}</strong></div>
    <div class="profile-row"><span>Best Time</span><strong>${formatTime(playerProfile.bestTime)}</strong></div>
    <div class="profile-row"><span>Best Moves</span><strong>${playerProfile.bestMoves ?? '—'}</strong></div>
    <div class="profile-row"><span>Session</span><strong>${activeSession?.id?.slice(0,10) ?? '—'}</strong></div>
    <div class="profile-achievements">${playerProfile.achievements.slice(-3).map(a=>`<span>${a}</span>`).join('')}</div>`;
}

function updateStats(){
  if(gameActive){updateSession({seconds,moves,score});}
  const m=Math.floor(seconds/60),s=seconds%60;
  document.getElementById('timerDisplay').textContent=`${m}:${s.toString().padStart(2,'0')}`;
  document.getElementById('movesDisplay').textContent=moves;
  document.getElementById('scoreDisplay').textContent=score;
  document.getElementById('rewardDisplay').textContent=totalEarned.toFixed(3);
}

function drawStock(){
  if(stock.length===0){if(!waste.length)return;stock=[...waste].reverse().map(c=>({...c,face:false}));waste=[];score=Math.max(0,score-100);}
  else{const c=stock.pop();c.face=true;waste.push(c);moves++;score+=5;}
  updateStats();render();
}

function canF(card,f){const fd=foundations[f];if(!fd.length)return card.val==='A';const t=fd[fd.length-1];return t.suit===card.suit&&VAL_NUM[card.val]===VAL_NUM[t.val]+1;}
function canT(card,col){const t=tableau[col];if(!t.length)return card.val==='K';const top=t[t.length-1];if(!top.face)return false;return SUIT_CLR[card.suit]!==SUIT_CLR[top.suit]&&VAL_NUM[card.val]===VAL_NUM[top.val]-1;}

function flipTop(col){const c=tableau[col];if(c.length&&!c[c.length-1].face){c[c.length-1].face=true;score+=5;}}

function tryAutoFoundation(card,sType,sIdx,cIdx){
  for(let f=0;f<4;f++){
    if(canF(card,f)){
      removeCard(sType,sIdx,cIdx);
      foundations[f].push(card);
      score+=15;moves++;
      updateStats();checkWin();render();
      return true;
    }
  }
  return false;
}

function removeCard(sType,sIdx,cIdx){
  if(sType==='waste')waste.pop();
  else if(sType==='tableau'){tableau[sIdx].splice(cIdx);flipTop(sIdx);}
  else if(sType==='foundation')foundations[sIdx].pop();
}

// Central click handler — called by every card and every slot
function handleClick(type, idx, cardIdx){
  // Clicking stock
  if(type==='stock'){drawStock();return;}

  // Nothing selected yet — select this card
  if(!sel){
    let card=null;
    if(type==='waste'&&waste.length)card=waste[waste.length-1];
    else if(type==='foundation'&&foundations[idx].length)card=foundations[idx][foundations[idx].length-1];
    else if(type==='tableau'&&tableau[idx][cardIdx]?.face)card=tableau[idx][cardIdx];
    if(!card)return;
    // Try auto-move to foundation on single top-card click
    const sIdx2=idx,cIdx2=cardIdx;
    const isSingleCard=(type==='waste')||(type==='tableau'&&cardIdx===tableau[idx].length-1)||(type==='foundation');
    if(isSingleCard&&tryAutoFoundation(card,type,sIdx2,cIdx2))return;
    sel={card,sType:type,sIdx:idx,cIdx:cardIdx};
    render();
    return;
  }

  // Something already selected — try to move it here
  const {card,sType,sIdx,cIdx}=sel;
  let moved=false;

  if(type==='foundation'||(type==='tableau'&&cardIdx===-1)){
    // dropping on foundation slot or empty tableau
    const destIdx=idx;
    if(type==='foundation'){
      if(canF(card,destIdx)){
        const isTop=(sType==='waste')||(sType==='foundation')||(sType==='tableau'&&cIdx===tableau[sIdx].length-1);
        if(isTop){removeCard(sType,sIdx,cIdx);foundations[destIdx].push(card);score+=15;moves++;moved=true;}
        else showToast('Move only one card to foundation','error');
      }
    } else {
      // empty tableau col
      if(canT(card,destIdx)){
        const cards=pickupCards(sType,sIdx,cIdx);
        tableau[destIdx].push(...cards);score+=5;moves++;moved=true;
      }
    }
  } else if(type==='tableau'){
    // dropping on a face-up tableau card
    if(canT(card,idx)){
      const cards=pickupCards(sType,sIdx,cIdx);
      tableau[idx].push(...cards);score+=5;moves++;moved=true;
    }
  } else if(type==='waste'&&sType!=='waste'){
    // clicked waste while something else selected — deselect and select waste
    sel=null;
    if(waste.length){const c=waste[waste.length-1];if(tryAutoFoundation(c,'waste',-1,waste.length-1))return;sel={card:c,sType:'waste',sIdx:-1,cIdx:waste.length-1};}
    render();return;
  }

  if(moved){updateStats();checkWin();}
  sel=null;render();
}

function pickupCards(sType,sIdx,cIdx){
  if(sType==='waste')return[waste.pop()];
  if(sType==='foundation')return[foundations[sIdx].pop()];
  if(sType==='tableau'){const cards=tableau[sIdx].splice(cIdx);flipTop(sIdx);return cards;}
  return[];
}

function generateMatchId(){
  return 'match_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
}

function getInviteLink(matchId){
  const url=new URL(window.location.href);
  url.searchParams.set('match',matchId);
  return url.toString();
}

function detectInviteMatch(){
  const params=new URLSearchParams(window.location.search);
  const match=params.get('match');
  if(match){
    invitedMatchId=match;
    currentMatchId=match;
    gameMode='pvp';
  }
}

function createPvpMatch(){
  currentMatchId=generateMatchId();
  const link=getInviteLink(currentMatchId);
  navigator.clipboard?.writeText(link).then(
    ()=>showToast('🔗 PvP invite link copied!','success'),
    ()=>showToast('🔗 Invite link created. Copy it from the panel.','info')
  );
  updateOpponentUI();
}

function setupRobotOpponent(){
  robotProgress=0;
  robotHasFinished=false;
  robotFinishTime=150+Math.floor(Math.random()*90);
  updateOpponentUI();
}

function updateMissionsUI(){
  const el=document.getElementById('missionsPanel');
  if(!el)return;

  const data=loadDailyMissions();

  el.innerHTML=`<div class="missions-title">Daily Missions</div>` + data.missions.map(m=>{
    return `<div class="mission-item ${m.completed?'done':''}">
      <div>
        <strong>${m.completed?'✅ ':''}${m.title}</strong>
        <span>${m.progress}/${m.target} • +${m.rewardXP} XP</span>
      </div>
    </div>`;
  }).join('');
}

function awardCompletedMissions(before, after){
  const completed=getCompletedMissionRewards(before, after);
  if(!completed.length||!playerProfile)return;

  completed.forEach(m=>{
    playerProfile=saveProfile({
      ...playerProfile,
      xp: playerProfile.xp + m.rewardXP,
      level: Math.max(playerProfile.level, Math.floor(Math.sqrt((playerProfile.xp + m.rewardXP)/100)))
    });
    showToast(`🎯 Mission complete: ${m.title} (+${m.rewardXP} XP)`,'success');
  });

  updateProfileUI();
}

function updateHistoryUI(){
  const el=document.getElementById('historyPanel');
  if(!el)return;

  const history=loadHistory().slice(0,5);

  if(!history.length){
    el.innerHTML=`<div class="history-title">Recent Games</div><p class="history-empty">No completed games yet.</p>`;
    return;
  }

  el.innerHTML=`<div class="history-title">Recent Games</div>` + history.map(h=>{
    const result=h.won?'Won':h.timedOut?'Timed out':'Ended';
    const time=formatTime(h.seconds);
    return `<div class="history-item">
      <div><strong>${result}</strong><span>${h.mode} • ${time} • ${h.moves} moves</span></div>
      <small>${h.score} pts</small>
    </div>`;
  }).join('');
}

function updateOpponentUI(){
  const el=document.getElementById('opponentPanel');
  if(!el)return;

  if(gameMode==='solo'){
    el.style.display='none';
    return;
  }

  el.style.display='block';

  if(gameMode==='robot'){
    el.innerHTML=`<div class="opponent-title">🤖 Robot Opponent</div>
      <div class="opponent-row"><span>Mode</span><strong>Player vs Robot</strong></div>
      <div class="opponent-row"><span>Robot progress</span><strong>${Math.min(robotProgress,100)}%</strong></div>
      <div class="opponent-meter"><div style="width:${Math.min(robotProgress,100)}%"></div></div>`;
  }else if(gameMode==='pvp'){
    const link=currentMatchId?getInviteLink(currentMatchId):'';
    el.innerHTML=`<div class="opponent-title">👥 Player vs Player</div>
      <div class="opponent-row"><span>Match</span><strong>${currentMatchId?'Created':'Not created'}</strong></div>
      <div class="opponent-row"><span>Status</span><strong>${invitedMatchId?'Joined via invite':'Invite mode'}</strong></div>
      ${currentMatchId?`<div class="invite-box">${link}</div>`:''}
      <button class="btn btn-sm" id="createPvpBtn" style="margin-top:10px">${currentMatchId?'Copy Invite Link':'Create Invite Link'}</button>
      <p class="opponent-note">First version: share the link and compare completion time. Real-time multiplayer comes next.</p>`;

    setTimeout(()=>{
      const btn=document.getElementById('createPvpBtn');
      if(btn){
        btn.onclick=()=>{
          if(!currentMatchId)createPvpMatch();
          else{
            navigator.clipboard?.writeText(getInviteLink(currentMatchId));
            showToast('🔗 Invite link copied!','success');
          }
        };
      }
    },0);
  }
}

function robotTick(){
  if(gameMode!=='robot'||robotHasFinished||!gameActive)return;

  robotProgress=Math.floor((seconds/robotFinishTime)*100);
  updateOpponentUI();

  if(seconds>=robotFinishTime){
    robotHasFinished=true;
    clearInterval(timerInterval);
    gameActive=false;
    sel=null;
    showToast('🤖 Robot finished first. You lost this round.','error');
    render();
  }
}

function endGameTimeout(){
  clearInterval(timerInterval);
  gameActive=false;
  sel=null;
  finishSession({won:false,timedOut:true,seconds,moves,score});
  updateHistoryUI();
  showToast('⏰ Time up! 4 minutes reached. New game starting...','error');
  document.getElementById('winOverlay').classList.remove('show');
  render();

  setTimeout(()=>{
    if(!gameActive){
      newGame();
    }
  },1800);
}

function setGameMode(mode){
  gameMode=mode;
  document.querySelectorAll('.mode-btn').forEach(btn=>btn.classList.remove('active'));
  const active=document.querySelector(`[data-mode="${mode}"]`);
  if(active)active.classList.add('active');

  if(mode==='pvp'&&!currentMatchId){currentMatchId=null;}
  if(mode==='robot'){
    showToast('🤖 Player vs Robot mode selected. Robot logic coming next.','info');
  }else if(mode==='pvp'){
    showToast('👥 Player vs Player mode selected. Multiplayer logic coming next.','info');
  }else{
    showToast('♠ Solo mode selected.','success');
  }

  newGame();
}

function checkWin(){
  if(!foundations.every(f=>f.length===13))return;
  clearInterval(timerInterval);gameActive=false;
  if(gameMode==='robot'&&!robotHasFinished){showToast('🏆 You beat the robot!','success');}
  _fastWin=seconds<120;_efficient=moves<100;
  finishSession({won:true,timedOut:false,seconds,moves,score});
  let beforeMissionWin=loadDailyMissions();
  let afterMissionWin=progressMission('win_one',1);
  awardCompletedMissions(beforeMissionWin,afterMissionWin);
  if(seconds<240){
    beforeMissionWin=loadDailyMissions();
    afterMissionWin=progressMission('under_four_minutes',1);
    awardCompletedMissions(beforeMissionWin,afterMissionWin);
  }
  updateHistoryUI();
  const reward=calcReward();totalEarned+=reward;if(playerProfile){playerProfile=recordWin(playerProfile,{seconds,moves,reward});updateProfileUI();}updateStats();
  document.getElementById('winReward').innerHTML=`+${reward.toFixed(3)} STX <span>Completed in ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} before the 4-minute limit</span>`;
  document.getElementById('winOverlay').classList.add('show');
  launchConfetti();
}
function calcReward(){let r=0.05;if(seconds<120)r+=0.02;else if(seconds<300)r+=0.01;if(moves<100)r+=0.01;return r;}

// ── Render ────────────────────────────────────────────────
function mkCardEl(card,type,idx,cardIdx){
  if(!card.face){
    const el=document.createElement('div');
    el.className='card card-back';
    return el;
  }
  const isSel=sel&&sel.sType===type&&sel.sIdx===idx&&sel.cIdx<=cardIdx&&(type==='tableau'||sel.cIdx===cardIdx);
  const el=document.createElement('div');
  el.className=`card ${SUIT_CLR[card.suit]}${isSel?' selected':''}`;
  el.innerHTML=`<div class="card-face"><div class="card-corner"><div class="card-val">${card.val}</div><div class="card-suit">${card.suit}</div></div><div class="card-center">${card.suit}</div><div class="card-corner bottom"><div class="card-val">${card.val}</div><div class="card-suit">${card.suit}</div></div></div>`;
  el.addEventListener('click',e=>{
    e.stopPropagation();
    handleClick(type,idx,cardIdx);
  });
  return el;
}

function render(){
  // Stock
  const stockSlot=document.getElementById('stock');
  stockSlot.innerHTML='';
  const sEl=document.createElement('div');
  if(stock.length){sEl.className='card card-back';sEl.style.position='relative';}
  else{sEl.className='card';sEl.style.cssText='position:relative;background:rgba(255,255,255,.04);border:2px dashed var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:28px;color:var(--muted)';sEl.textContent='↩';}
  sEl.addEventListener('click',e=>{e.stopPropagation();handleClick('stock',-1,-1);});
  stockSlot.appendChild(sEl);

  // Waste
  const wasteSlot=document.getElementById('waste');
  wasteSlot.innerHTML='';
  if(waste.length){
    const el=mkCardEl(waste[waste.length-1],'waste',-1,waste.length-1);
    el.style.position='relative';
    wasteSlot.appendChild(el);
  }
  // click on empty waste = deselect
  wasteSlot.addEventListener('click',e=>{e.stopPropagation();if(!waste.length&&sel){sel=null;render();}});

  // Foundations
  const fc=document.getElementById('foundations');
  fc.innerHTML='';
  for(let f=0;f<4;f++){
    const slot=document.createElement('div');
    slot.className='card-slot';
    slot.style.cursor='pointer';
    if(foundations[f].length){
      const el=mkCardEl(foundations[f][foundations[f].length-1],'foundation',f,foundations[f].length-1);
      el.style.position='relative';
      slot.appendChild(el);
    } else {
      slot.innerHTML=`<span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:22px;color:var(--border)">${SUITS[f]}</span>`;
    }
    slot.addEventListener('click',e=>{e.stopPropagation();handleClick('foundation',f,-1);});
    fc.appendChild(slot);
  }

  // Tableau
  const tc=document.getElementById('tableau');
  tc.innerHTML='';
  for(let col=0;col<7;col++){
    const colEl=document.createElement('div');
    colEl.className='tableau-col';
    const colCards=tableau[col];
    colEl.style.minHeight=Math.max(110,colCards.length*24+90)+'px';

    if(colCards.length===0){
      // empty col — click to drop King
      colEl.addEventListener('click',e=>{e.stopPropagation();handleClick('tableau',col,-1);});
    }

    colCards.forEach((card,idx)=>{
      const el=mkCardEl(card,'tableau',col,idx);
      el.style.cssText=`position:absolute;top:${idx*24}px;left:0;z-index:${idx+1}`;
      colEl.appendChild(el);
    });

    tc.appendChild(colEl);
  }
}

function launchConfetti(){const colors=['#7c3aed','#a855f7','#06b6d4','#ec4899','#10b981','#f59e0b'];for(let i=0;i<80;i++)setTimeout(()=>{const el=document.createElement('div');el.className='confetti-piece';el.style.cssText=`left:${Math.random()*100}vw;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${1.5+Math.random()*2}s;animation-delay:${Math.random()*.5}s;width:${6+Math.random()*8}px;height:${6+Math.random()*8}px`;document.body.appendChild(el);setTimeout(()=>el.remove(),4000);},i*30);}
function showToast(msg,type='info'){const t=document.getElementById('toast');t.textContent=msg;t.className=`toast ${type} show`;clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),3200);}
window.showToast=showToast;

// ── DOM ───────────────────────────────────────────────────
document.getElementById('app').innerHTML=`<header><div class="logo"><div class="logo-icon">♠</div>STX<span>Solitaire</span></div><div class="wallet-section"><div class="balance-pill" id="balancePill" style="display:none"><span class="dot"></span><span id="walletAddr" style="font-size:11px;color:var(--muted)"></span>&nbsp;|&nbsp;<span id="balanceAmt">0.00</span> STX</div><button class="btn btn-primary" id="connectBtn">Connect Wallet</button><button class="btn btn-sm" id="disconnectBtn" style="display:none">Disconnect</button></div></header><div class="mode-bar" id="modeBar" style="display:none"><button class="mode-btn active" data-mode="solo" id="soloModeBtn">♠ Solo</button><button class="mode-btn" data-mode="robot" id="robotModeBtn">🤖 Player vs Robot</button><button class="mode-btn" data-mode="pvp" id="pvpModeBtn">👥 Player vs Player</button></div><div class="stats-bar" id="statsBar" style="display:none"><div class="stat">🕐 <strong id="timerDisplay">0:00</strong> Time</div><div class="stat-divider"></div><div class="stat">🔄 <strong id="movesDisplay">0</strong> Moves</div><div class="stat-divider"></div><div class="stat">🏆 <strong id="scoreDisplay">0</strong> Score</div><div class="stat-divider"></div><div class="stat">💎 <strong id="rewardDisplay">0.000</strong> STX Earned</div><div class="stat-divider"></div><button class="btn btn-sm" id="newGameBtn">New Game</button></div><div class="game-wrap"><div class="wallet-gate" id="walletGate"><div class="gate-icon">♠</div><h2>Play. Compete. Earn.</h2><p>Connect your Stacks wallet to play. Win games, build your profile, earn XP, and claim limited STX rewards on-chain.</p><div class="reward-chips"><div class="chip purple">💎 Up to 0.08 STX daily reward</div><div class="chip cyan">⚡ Speed bonuses</div><div class="chip green">🔗 On-chain verified</div></div><button class="btn btn-primary" style="padding:12px 32px;font-size:16px" id="connectBtn2">Connect Stacks Wallet</button><p style="font-size:12px;color:var(--muted)">Works with Hiro Wallet & Xverse</p></div><div class="board" id="board"><div class="top-row"><div class="top-left"><div class="card-slot" id="stock"></div><div class="card-slot" id="waste"></div></div><div class="top-right" id="foundations"></div></div><div class="tableau" id="tableau"></div></div><aside class="profile-card" id="profileCard"></aside><aside class="opponent-panel" id="opponentPanel"></aside><aside class="history-panel" id="historyPanel"></aside><aside class="missions-panel" id="missionsPanel"></aside></div><div class="win-overlay" id="winOverlay"><div class="win-card"><div class="win-emoji">🎉</div><h2>You Won!</h2><p>Amazing! You completed the game and earned STX rewards on Stacks.</p><div class="reward-display" id="winReward">+0.05 STX <span>Daily reward claim on Stacks</span></div><div style="display:flex;gap:10px;justify-content:center;margin-top:8px"><button class="btn btn-green" id="claimBtn">Claim Reward 🔗</button><button class="btn btn-sm" id="playAgainBtn">Play Again</button></div></div></div><div class="toast" id="toast"></div>`;

function afterConnect(user){
  const addr=user?.profile?.stxAddress?.testnet||'SP2X…K9QM';
  playerProfile=loadProfile(addr);
  saveProfile(playerProfile);
  document.getElementById('walletGate').style.display='none';
  document.getElementById('connectBtn').style.display='none';
  document.getElementById('disconnectBtn').style.display='inline-block';
  document.getElementById('balancePill').style.display='flex';
  document.getElementById('walletAddr').textContent=addr.slice(0,6)+'…'+addr.slice(-4);
  document.getElementById('balanceAmt').textContent='2.50';
  document.getElementById('modeBar').style.display='flex';
  document.getElementById('statsBar').style.display='flex';
  document.getElementById('board').classList.add('active');
  showToast('✅ Wallet connected!','success');
  updateProfileUI();
  newGame();
}

document.getElementById('connectBtn').onclick=()=>connectWallet(afterConnect);
document.getElementById('connectBtn2').onclick=()=>connectWallet(afterConnect);
document.getElementById('disconnectBtn').onclick=()=>{signOut();location.reload();};
document.getElementById('newGameBtn').onclick=newGame;
document.getElementById('soloModeBtn').onclick=()=>setGameMode('solo');
document.getElementById('robotModeBtn').onclick=()=>setGameMode('robot');
document.getElementById('pvpModeBtn').onclick=()=>{setGameMode('pvp');updateOpponentUI();};
document.getElementById('playAgainBtn').onclick=()=>{document.getElementById('winOverlay').classList.remove('show');newGame();};
document.getElementById('claimBtn').onclick=()=>{showToast('📡 Broadcasting to Stacks testnet…','info');claimRewardOnChain(score,_fastWin,_efficient,txId=>showToast(`✅ Claimed! TX: ${txId.slice(0,12)}…`,'success'),err=>showToast(`⚠️ ${err}`,'error'));document.getElementById('winOverlay').classList.remove('show');newGame();};

detectInviteMatch();
if(isSignedIn())afterConnect(getUser());
