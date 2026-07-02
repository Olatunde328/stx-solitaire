import './style.css';

const SUITS = ['♠','♥','♦','♣'];
const RED = new Set(['♥','♦']);
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const MAX_GAME_SECONDS = 240;

let deck = [];
let stock = [];
let waste = [];
let foundations = [[],[],[],[]];
let tableau = [[],[],[],[],[],[],[]];
let selected = null;
let seconds = 0;
let moves = 0;
let score = 0;
let timer = null;
let active = false;

function buildDeck(){
  return SUITS.flatMap(suit => VALUES.map((val, i) => ({
    suit,
    val,
    rank: i + 1,
    face: false,
    id: `${suit}-${val}-${Math.random()}`
  })));
}

function shuffle(cards){
  const a = [...cards];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function startGame(){
  clearInterval(timer);
  deck = shuffle(buildDeck());
  stock = [];
  waste = [];
  foundations = [[],[],[],[]];
  tableau = [[],[],[],[],[],[],[]];
  selected = null;
  seconds = 0;
  moves = 0;
  score = 0;
  active = true;

  let index = 0;
  for(let col=0; col<7; col++){
    for(let row=0; row<=col; row++){
      const card = deck[index++];
      card.face = row === col;
      tableau[col].push(card);
    }
  }

  stock = deck.slice(index).map(c => ({...c, face:false}));

  timer = setInterval(() => {
    seconds++;
    updateStats();
    if(seconds >= MAX_GAME_SECONDS){
      gameOver();
    }
  }, 1000);

  document.getElementById('gameOver').classList.remove('show');
  render();
  updateStats();
}

function gameOver(){
  clearInterval(timer);
  active = false;
  document.getElementById('gameOver').classList.add('show');
  document.getElementById('gameOverTitle').textContent = 'Game Over';
  document.getElementById('gameOverText').textContent = 'Your 4 minutes are up. Play again or quit for now.';
}

function winGame(){
  clearInterval(timer);
  active = false;
  document.getElementById('gameOver').classList.add('show');
  document.getElementById('gameOverTitle').textContent = 'You Won!';
  document.getElementById('gameOverText').textContent = `Completed in ${formatTime(seconds)} with ${moves} moves.`;
}

function drawStock(){
  if(!active)return;

  if(stock.length){
    const card = stock.pop();
    card.face = true;
    waste.push(card);
  }else{
    stock = waste.reverse().map(c => ({...c, face:false}));
    waste = [];
  }

  moves++;
  render();
  updateStats();
}

function canMoveToFoundation(card, pile){
  if(!card)return false;
  if(!pile.length)return card.rank === 1;
  const top = pile[pile.length-1];
  return top.suit === card.suit && card.rank === top.rank + 1;
}

function canMoveToTableau(card, pile){
  if(!card)return false;
  if(!pile.length)return card.rank === 13;
  const top = pile[pile.length-1];
  return top.face && RED.has(card.suit) !== RED.has(top.suit) && card.rank === top.rank - 1;
}

function selectCard(source, col, index){
  selected = {source, col, index};
  render();
}

function getSelectedCards(){
  if(!selected)return [];
  if(selected.source === 'waste') return [waste[waste.length-1]];
  if(selected.source === 'tableau') return tableau[selected.col].slice(selected.index);
  return [];
}

function removeSelected(){
  if(!selected)return;
  if(selected.source === 'waste') waste.pop();
  if(selected.source === 'tableau'){
    tableau[selected.col].splice(selected.index);
    const pile = tableau[selected.col];
    if(pile.length && !pile[pile.length-1].face) pile[pile.length-1].face = true;
  }
  selected = null;
}

function moveToFoundation(f){
  const cards = getSelectedCards();
  if(cards.length !== 1)return;
  if(canMoveToFoundation(cards[0], foundations[f])){
    foundations[f].push(cards[0]);
    removeSelected();
    moves++;
    score += 100;
    checkWin();
    render();
    updateStats();
  }
}

function moveToTableau(col){
  const cards = getSelectedCards();
  if(!cards.length)return;
  if(canMoveToTableau(cards[0], tableau[col])){
    tableau[col].push(...cards);
    removeSelected();
    moves++;
    score += 15;
    render();
    updateStats();
  }
}

function checkWin(){
  if(foundations.every(p => p.length === 13)){
    winGame();
  }
}

function cardHTML(card, source, col, index){
  const color = RED.has(card.suit) ? 'red' : 'black';
  const selectedClass = selected &&
    selected.source === source &&
    selected.col === col &&
    selected.index <= index ? 'selected' : '';

  if(!card.face){
    return `<div class="card card-back" data-source="${source}" data-col="${col}" data-index="${index}"></div>`;
  }

  return `
    <div class="card ${color} ${selectedClass}" data-source="${source}" data-col="${col}" data-index="${index}">
      <div class="corner"><b>${card.val}</b><span>${card.suit}</span></div>
      <div class="center">${card.suit}</div>
      <div class="corner bottom"><b>${card.val}</b><span>${card.suit}</span></div>
    </div>
  `;
}

function render(){
  document.getElementById('stock').innerHTML = stock.length ? `<div class="card card-back"></div>` : `<div class="empty-card">↻</div>`;
  document.getElementById('waste').innerHTML = waste.length ? cardHTML(waste[waste.length-1], 'waste', -1, waste.length-1) : `<div class="empty-card"></div>`;

  document.getElementById('foundations').innerHTML = foundations.map((pile, i) => `
    <div class="foundation" data-foundation="${i}">
      ${pile.length ? cardHTML(pile[pile.length-1], 'foundation', i, pile.length-1) : `<span>${SUITS[i]}</span>`}
    </div>
  `).join('');

  document.getElementById('tableau').innerHTML = tableau.map((pile, col) => `
    <div class="tableau-col" data-tableau="${col}">
      ${pile.map((card, i) => `<div class="stack-card" style="top:${i*30}px">${cardHTML(card,'tableau',col,i)}</div>`).join('')}
    </div>
  `).join('');

  bindClicks();
}

function bindClicks(){
  document.getElementById('stock').onclick = drawStock;

  document.querySelectorAll('.card').forEach(el => {
    el.onclick = e => {
      e.stopPropagation();
      const source = el.dataset.source;
      const col = Number(el.dataset.col);
      const index = Number(el.dataset.index);

      if(source === 'foundation')return;
      const card = source === 'waste' ? waste[waste.length-1] : tableau[col]?.[index];
      if(!card?.face)return;

      selectCard(source, col, index);
    };
  });

  document.querySelectorAll('.foundation').forEach(el => {
    el.onclick = () => moveToFoundation(Number(el.dataset.foundation));
  });

  document.querySelectorAll('.tableau-col').forEach(el => {
    el.onclick = e => {
      if(e.target.closest('.card'))return;
      moveToTableau(Number(el.dataset.tableau));
    };
  });
}

function updateStats(){
  document.getElementById('time').textContent = formatTime(seconds);
  document.getElementById('moves').textContent = moves;
  document.getElementById('score').textContent = score;
}

function formatTime(sec){
  const m = Math.floor(sec/60);
  const s = sec%60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

document.getElementById('app').innerHTML = `
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">✦ STX <span>Solitaire</span></div>
      <div class="player-card">
        <div class="bot">🤖</div>
        <p class="connected">Connected ●</p>
        <h3>STX Player</h3>
        <small>Platinum Player</small>
      </div>
      <div class="stat-card"><span>Level</span><b>23</b></div>
      <div class="stat-card"><span>XP</span><b>5,680 / 8,000</b></div>
      <div class="stat-card"><span>STX Earned</span><b>12.482 STX</b></div>
      <button class="side-btn active">🎮 Play Game</button>
      <button class="side-btn">🎯 Missions</button>
      <button class="side-btn">🏆 Leaderboard</button>
      <button class="side-btn">🏅 Achievements</button>
      <button class="disconnect">Disconnect</button>
    </aside>

    <main class="main">
      <section class="hero">
        <div class="time-box">TIME LEFT <b id="time">0:00</b></div>
        <div>
          <h1>👑 STX SOLITAIRE</h1>
          <p>PLAY • WIN • EARN</p>
        </div>
        <div class="score-box">SCORE <b id="score">0</b></div>
      </section>

      <section class="board-panel">
        <div class="top-row">
          <div class="pile-row">
            <div id="stock" class="slot"></div>
            <div id="waste" class="slot"></div>
          </div>
          <div id="foundations" class="foundation-row"></div>
        </div>

        <div id="tableau" class="tableau"></div>

        <div class="controls">
          <button id="newGame">➕ New Game</button>
          <button>💡 Hint</button>
          <button>↩ Undo</button>
          <button>⏸ Pause</button>
        </div>
      </section>

      <section class="promo">
        <h2>PLAY SOLITAIRE<br><span>WIN STX REWARDS</span></h2>
        <p>Complete missions, climb the leaderboard, and compete for rewards.</p>
      </section>
    </main>

    <aside class="rightbar">
      <div class="panel">
        <h3>Daily Reward Pool</h3>
        <strong>245.75 STX</strong>
        <p>Rewards left: 12 / 20</p>
      </div>
      <div class="panel">
        <h3>Top Players</h3>
        <p>🥇 ST3...a1B2 — 12,850 XP</p>
        <p>🥈 ST3...c3D4 — 9,760 XP</p>
        <p>🥉 ST3...e5F6 — 8,240 XP</p>
      </div>
      <div class="panel">
        <h3>Achievements</h3>
        <p>🔥 Hot Streak</p>
        <p>⚡ Speed Runner</p>
        <p>🎯 Efficient Player</p>
      </div>
    </aside>
  </div>

  <div id="gameOver" class="overlay">
    <div class="modal">
      <h2 id="gameOverTitle">Game Over</h2>
      <p id="gameOverText">Your time is up.</p>
      <button id="playAgain">Play Again</button>
      <button id="quit">Quit</button>
    </div>
  </div>
`;

document.getElementById('newGame').onclick = startGame;
document.getElementById('playAgain').onclick = startGame;
document.getElementById('quit').onclick = () => document.getElementById('gameOver').classList.remove('show');

startGame();
