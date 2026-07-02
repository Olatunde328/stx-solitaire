import './style.css';
import {
  SUITS,
  RED,
  newGame,
  canMoveToTableau,
  canMoveToFoundation,
  revealTop,
  hasWon
} from './engine/game.js';

const MAX_SECONDS = 240;
let state = newGame();
let timer = null;

function startTimer(){
  clearInterval(timer);
  timer = setInterval(() => {
    if(!state.active) return;
    state.seconds++;
    updateStats();

    if(state.seconds >= MAX_SECONDS){
      endGame(false, 'Game Over', 'Your 4 minutes are up. Play again or quit for now.');
    }
  }, 1000);
}

function restart(){
  state = newGame();
  closeOverlay();
  render();
  updateStats();
  startTimer();
}

function drawStock(){
  if(!state.active) return;

  if(state.stock.length){
    const card = state.stock.pop();
    card.faceUp = true;
    state.waste.push(card);
  }else{
    state.stock = state.waste.reverse().map(c => ({...c, faceUp:false}));
    state.waste = [];
  }

  state.moves++;
  state.selected = null;
  render();
  updateStats();
}

function getSelectedCards(){
  const s = state.selected;
  if(!s) return [];

  if(s.zone === 'waste'){
    return state.waste.length ? [state.waste[state.waste.length - 1]] : [];
  }

  if(s.zone === 'tableau'){
    return state.tableau[s.col].slice(s.index);
  }

  return [];
}

function removeSelected(){
  const s = state.selected;
  if(!s) return;

  if(s.zone === 'waste'){
    state.waste.pop();
  }

  if(s.zone === 'tableau'){
    state.tableau[s.col].splice(s.index);
    revealTop(state.tableau, s.col);
  }

  state.selected = null;
}

function selectCard(zone, col, index){
  const card = zone === 'waste'
    ? state.waste[state.waste.length - 1]
    : state.tableau[col]?.[index];

  if(!card || !card.faceUp) return;

  state.selected = { zone, col, index };
  render();
}

function moveToTableau(col){
  const cards = getSelectedCards();
  if(!cards.length) return false;

  if(canMoveToTableau(cards[0], state.tableau[col])){
    state.tableau[col].push(...cards);
    removeSelected();
    state.moves++;
    state.score += 15;
    render();
    updateStats();
    return true;
  }

  return false;
}

function moveToFoundation(index){
  const cards = getSelectedCards();
  if(cards.length !== 1) return false;

  if(canMoveToFoundation(cards[0], state.foundations[index])){
    state.foundations[index].push(cards[0]);
    removeSelected();
    state.moves++;
    state.score += 100;
    render();
    updateStats();

    if(hasWon(state)){
      endGame(true, 'You Won!', `Completed in ${formatTime(state.seconds)} with ${state.moves} moves.`);
    }

    return true;
  }

  return false;
}

function endGame(won, title, text){
  state.active = false;
  clearInterval(timer);
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalText').textContent = text;
  document.getElementById('overlay').classList.add('show');
}

function closeOverlay(){
  document.getElementById('overlay').classList.remove('show');
}

function cardHTML(card, zone, col, index){
  if(!card.faceUp){
    return `<button class="card card-back" data-zone="${zone}" data-col="${col}" data-index="${index}" aria-label="Hidden card"></button>`;
  }

  const color = RED.has(card.suit) ? 'red' : 'black';
  const selected = state.selected &&
    state.selected.zone === zone &&
    state.selected.col === col &&
    state.selected.index <= index;

  return `
    <button class="card ${color} ${selected ? 'selected' : ''}" data-zone="${zone}" data-col="${col}" data-index="${index}">
      <span class="corner"><b>${card.value}</b><i>${card.suit}</i></span>
      <span class="center">${card.suit}</span>
      <span class="corner bottom"><b>${card.value}</b><i>${card.suit}</i></span>
    </button>
  `;
}

function render(){
  document.getElementById('stock').innerHTML = state.stock.length
    ? `<button class="card card-back" id="stockBtn"></button>`
    : `<button class="empty-card" id="stockBtn">↻</button>`;

  document.getElementById('waste').innerHTML = state.waste.length
    ? cardHTML(state.waste[state.waste.length - 1], 'waste', -1, state.waste.length - 1)
    : `<div class="empty-card"></div>`;

  document.getElementById('foundations').innerHTML = state.foundations.map((pile, i) => `
    <div class="foundation" data-foundation="${i}">
      ${pile.length ? cardHTML(pile[pile.length - 1], 'foundation', i, pile.length - 1) : `<span>${SUITS[i]}</span>`}
    </div>
  `).join('');

  document.getElementById('tableau').innerHTML = state.tableau.map((pile, col) => `
    <div class="tableau-col" data-tableau="${col}">
      ${pile.map((card, i) => `<div class="stack-card" style="top:${i * 30}px">${cardHTML(card, 'tableau', col, i)}</div>`).join('')}
    </div>
  `).join('');

  bindBoard();
}

function bindBoard(){
  document.getElementById('stockBtn').onclick = drawStock;

  document.querySelectorAll('.card').forEach(card => {
    card.onclick = e => {
      e.stopPropagation();

      const zone = card.dataset.zone;
      const col = Number(card.dataset.col);
      const index = Number(card.dataset.index);

      if(zone === 'foundation') return;

      if(state.selected && zone === 'tableau' && state.selected.col !== col){
        if(!moveToTableau(col)) selectCard(zone, col, index);
        return;
      }

      selectCard(zone, col, index);
    };
  });

  document.querySelectorAll('.tableau-col').forEach(colEl => {
    colEl.onclick = e => {
      if(e.target.closest('.card')) return;
      moveToTableau(Number(colEl.dataset.tableau));
    };
  });

  document.querySelectorAll('.foundation').forEach(f => {
    f.onclick = () => moveToFoundation(Number(f.dataset.foundation));
  });
}

function updateStats(){
  document.getElementById('time').textContent = formatTime(state.seconds);
  document.getElementById('moves').textContent = state.moves;
  document.getElementById('score').textContent = state.score;
}

function formatTime(seconds){
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

document.getElementById('app').innerHTML = `
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">♠ STX <span>Solitaire V2</span></div>
      <div class="profile">
        <div class="avatar">🃏</div>
        <h3>Stacks Player</h3>
        <p>Play. Compete. Earn.</p>
      </div>
      <div class="mini"><span>Level</span><b>1</b></div>
      <div class="mini"><span>XP</span><b>0</b></div>
      <div class="mini"><span>Rewards</span><b>Testnet Ready</b></div>
    </aside>

    <main class="main">
      <section class="hero">
        <div class="hero-box"><span>Time</span><b id="time">0:00</b></div>
        <div class="hero-title">
          <h1>STX SOLITAIRE</h1>
          <p>Premium Web3 Solitaire on Stacks</p>
        </div>
        <div class="hero-box"><span>Score</span><b id="score">0</b></div>
      </section>

      <section class="board">
        <div class="top-row">
          <div class="pile-row">
            <div id="stock" class="slot"></div>
            <div id="waste" class="slot"></div>
          </div>
          <div id="foundations" class="foundation-row"></div>
        </div>

        <div id="tableau" class="tableau"></div>

        <div class="controls">
          <button id="newGame">New Game</button>
          <div>Moves: <b id="moves">0</b></div>
        </div>
      </section>
    </main>

    <aside class="rightbar">
      <div class="panel"><h3>Daily Missions</h3><p>Win 1 game</p><p>Finish under 4 minutes</p></div>
      <div class="panel"><h3>Leaderboard</h3><p>Coming back next</p></div>
      <div class="panel"><h3>Achievements</h3><p>First Win • Speed Runner</p></div>
    </aside>
  </div>

  <div class="overlay" id="overlay">
    <div class="modal">
      <h2 id="modalTitle">Game Over</h2>
      <p id="modalText">Your time is up.</p>
      <button id="playAgain">Play Again</button>
      <button id="quit">Quit</button>
    </div>
  </div>
`;

document.getElementById('newGame').onclick = restart;
document.getElementById('playAgain').onclick = restart;
document.getElementById('quit').onclick = closeOverlay;

restart();
