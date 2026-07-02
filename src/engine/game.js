export const SUITS = ['♠','♥','♦','♣'];
export const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
export const RED = new Set(['♥','♦']);

export function createDeck(){
  return SUITS.flatMap(suit =>
    VALUES.map((value, index) => ({
      id: `${suit}-${value}-${crypto.randomUUID()}`,
      suit,
      value,
      rank: index + 1,
      faceUp: false
    }))
  );
}

export function shuffle(deck){
  const cards = [...deck];
  for(let i = cards.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function newGame(){
  const deck = shuffle(createDeck());
  const tableau = [[],[],[],[],[],[],[]];
  let index = 0;

  for(let col = 0; col < 7; col++){
    for(let row = 0; row <= col; row++){
      const card = deck[index++];
      card.faceUp = row === col;
      tableau[col].push(card);
    }
  }

  return {
    stock: deck.slice(index).map(c => ({...c, faceUp:false})),
    waste: [],
    foundations: [[],[],[],[]],
    tableau,
    selected: null,
    moves: 0,
    score: 0,
    seconds: 0,
    active: true
  };
}

export function isRed(card){
  return RED.has(card.suit);
}

export function canMoveToTableau(card, pile){
  if(!card) return false;
  if(!pile.length) return card.rank === 13;
  const top = pile[pile.length - 1];
  return top.faceUp && isRed(card) !== isRed(top) && card.rank === top.rank - 1;
}

export function canMoveToFoundation(card, pile){
  if(!card) return false;
  if(!pile.length) return card.rank === 1;
  const top = pile[pile.length - 1];
  return card.suit === top.suit && card.rank === top.rank + 1;
}

export function revealTop(tableau, col){
  const pile = tableau[col];
  if(pile.length && !pile[pile.length - 1].faceUp){
    pile[pile.length - 1].faceUp = true;
  }
}

export function hasWon(state){
  return state.foundations.every(pile => pile.length === 13);
}


export function canMoveSequence(cards){
  if(!cards.length) return false;
  if(cards.some(card => !card.faceUp)) return false;

  for(let i = 0; i < cards.length - 1; i++){
    const current = cards[i];
    const next = cards[i + 1];

    if(isRed(current) === isRed(next)) return false;
    if(current.rank !== next.rank + 1) return false;
  }

  return true;
}
