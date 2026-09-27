// ============================================================
//  CHESS ENGINE
// ============================================================

// ── Piece sets ───────────────────────────────────────────────
// Add more sets here by creating a new folder with the same filenames.
// Each set needs: King, Queen, Rook, Bishop, Knight, Pawn in _W and _B variants.
const PIECE_SETS = {
  "Classic": "./Pieces/Classic",
  "Normal":  "./Pieces/Normal",
  "Neo":     "./Pieces/Neo",
  "Techno":  "./Pieces/Techno",
};

let currentPieceSet = "Classic";

function getPieceImg(colorType) {
  const folder = PIECE_SETS[currentPieceSet] || "./Pieces";
  const names = {
    wK:'King_W',   wQ:'Queen_W',  wR:'Rook_W',
    wB:'Bishop_W', wN:'Knight_W', wP:'Pawn_W',
    bK:'King_B',   bQ:'Queen_B',  bR:'Rook_B',
    bB:'Bishop_B', bN:'Knight_B', bP:'Pawn_B'
  };
  return `${folder}/${names[colorType]}.png`;
}

function pieceImg(colorType, size=60) {
  const img = document.createElement('img');
  img.src = getPieceImg(colorType);
  img.width = size;
  img.height = size;
  img.draggable = false;
  img.style.pointerEvents = 'none';
  img.style.display = 'block';
  return img;
}

// ── Board themes ──────────────────────────────────────────────
const BOARD_THEMES = {
  "Walnut":   { light: "#e8d5b0", dark: "#8b6843", cls: "theme-walnut"   },
  "Ocean":    { light: "#d6e4ee", dark: "#3a7ab5", cls: "theme-ocean"    },
  "Forest":   { light: "#eef0d4", dark: "#4a7a42", cls: "theme-forest"   },
  "Midnight": { light: "#b8c0cc", dark: "#3a4560", cls: "theme-midnight" },
  "Rose":     { light: "#f4ddd8", dark: "#9a4a58", cls: "theme-rose"     },
  "Slate":    { light: "#d0d0d8", dark: "#606878", cls: "theme-slate"    },
};

let currentBoardTheme = "Walnut";

const PIECE_VALUES = { K:0, Q:9, R:5, B:3, N:3, P:1 };

// ============================================================
//  OPENINGS DATA
//  Each opening is defined in its own file in the Openings/
//  folder. Those files push into this shared object.
// ============================================================
const Openings = {
  "King's Gambit": {"Lines": KingGambit},
  "Queen's Gambit Accepted": {"Lines": QueenGambitAcepted},
  "Queen's Gambit Declined": {"Lines": QueenGambitDeclined},
  // "": {"Lines": KingGambit},
};

// ============================================================
//  REPERTOIRE STATE
// ============================================================
let repertoireMode = false;
let repLine        = null;
let repIndex       = 0;
let repError       = false;

// ============================================================
//  BOARD STATE
// ============================================================
let board = [];
let turn = 'w';
let enPassantTarget = null;
let castlingRights = { wK:true, wQ:true, bK:true, bQ:true };
let moveHistory = [];
let capturedPieces = { w: [], b: [] };
let flipped = false;
let gameOver = false;
let pendingPromo = null;

function findKing(color, brd) {
  for (let i = 0; i < 64; i++) {
    if (brd[i] && brd[i].type === 'K' && brd[i].color === color) return i;
  }
  return -1;
}

function initBoard() {
  board = new Array(64).fill(null);
  const backRank = ['R','N','B','Q','K','B','N','R'];
  for (let i = 0; i < 8; i++) {
    board[i]    = {type: backRank[i], color: 'b'};
    board[i+8]  = {type: 'P', color: 'b'};
    board[48+i] = {type: 'P', color: 'w'};
    board[56+i] = {type: backRank[i], color: 'w'};
  }
  turn = 'w';
  enPassantTarget = null;
  castlingRights = { wK:true, wQ:true, bK:true, bQ:true };
  moveHistory = [];
  capturedPieces = { w: [], b: [] };
  gameOver = false;
  pendingPromo = null;
}

function idxToRC(idx) { return { row: Math.floor(idx/8), col: idx%8 }; }
function rcToIdx(r,c)  { return r*8+c; }
function inBounds(r,c) { return r>=0 && r<8 && c>=0 && c<8; }
function opponent(color) { return color==='w'?'b':'w'; }

// ============================================================
//  MOVE GENERATION
// ============================================================

function getPseudoLegalMoves(idx, brd, ep, castle) {
  const piece = brd[idx];
  if (!piece) return [];
  const {type, color} = piece;
  const {row, col} = idxToRC(idx);
  const moves = [];
  const opp = opponent(color);

  const addIfValid = (r,c) => {
    if (!inBounds(r,c)) return false;
    const dest = rcToIdx(r,c);
    const target = brd[dest];
    if (target && target.color === color) return false;
    moves.push({from: idx, to: dest});
    return !target;
  };

  const slide = (drs) => {
    for (const [dr,dc] of drs) {
      let r=row+dr, c=col+dc;
      while (inBounds(r,c)) {
        const dest = rcToIdx(r,c);
        const target = brd[dest];
        if (target) {
          if (target.color !== color) moves.push({from:idx, to:dest});
          break;
        }
        moves.push({from:idx, to:dest});
        r+=dr; c+=dc;
      }
    }
  };

  if (type === 'P') {
    const dir = color==='w' ? -1 : 1;
    const startRow = color==='w' ? 6 : 1;
    const promoRow = color==='w' ? 0 : 7;

    const fr = row+dir, fc = col;
    if (inBounds(fr,fc) && !brd[rcToIdx(fr,fc)]) {
      moves.push({from:idx, to:rcToIdx(fr,fc), promo: fr===promoRow});
      if (row === startRow && !brd[rcToIdx(fr+dir,fc)]) {
        moves.push({from:idx, to:rcToIdx(fr+dir,fc), doublePush:true});
      }
    }
    for (const dc of [-1,1]) {
      const cr=row+dir, cc=col+dc;
      if (!inBounds(cr,cc)) continue;
      const dest = rcToIdx(cr,cc);
      if (brd[dest] && brd[dest].color===opp) {
        moves.push({from:idx, to:dest, promo: cr===promoRow});
      }
      if (ep !== null && dest === ep) {
        moves.push({from:idx, to:dest, enPassant:true});
      }
    }
  }
  else if (type === 'N') {
    for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      addIfValid(row+dr, col+dc);
    }
  }
  else if (type === 'B') { slide([[-1,-1],[-1,1],[1,-1],[1,1]]); }
  else if (type === 'R') { slide([[-1,0],[1,0],[0,-1],[0,1]]); }
  else if (type === 'Q') { slide([[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]); }
  else if (type === 'K') {
    for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      addIfValid(row+dr, col+dc);
    }
    if (castle) {
      const rank = color==='w' ? 7 : 0;
      const kIdx = rcToIdx(rank, 4);
      if (idx === kIdx) {
        if (castle[color+'K'] && !brd[rcToIdx(rank,5)] && !brd[rcToIdx(rank,6)]) {
          moves.push({from:idx, to:rcToIdx(rank,6), castle:'K'});
        }
        if (castle[color+'Q'] && !brd[rcToIdx(rank,3)] && !brd[rcToIdx(rank,2)] && !brd[rcToIdx(rank,1)]) {
          moves.push({from:idx, to:rcToIdx(rank,2), castle:'Q'});
        }
      }
    }
  }

  return moves;
}

function isSquareAttackedBy(sq, attackerColor, brd) {
  for (let i=0; i<64; i++) {
    const p = brd[i];
    if (!p || p.color !== attackerColor) continue;
    const moves = getPseudoLegalMoves(i, brd, null, null);
    if (moves.some(m => m.to === sq)) return true;
  }
  return false;
}

function applyMove(brd, move, epTarget, castleRights) {
  const newBrd = [...brd];
  const newCastle = {...castleRights};
  let newEP = null;
  let captured = null;

  const piece = newBrd[move.from];
  const {color, type} = piece;

  if (move.enPassant) {
    const dir = color==='w' ? 1 : -1;
    const capIdx = move.to + dir*8;
    captured = newBrd[capIdx];
    newBrd[capIdx] = null;
  } else {
    captured = newBrd[move.to];
  }

  newBrd[move.to] = piece;
  newBrd[move.from] = null;

  if (move.promo && move.promoType) {
    newBrd[move.to] = {type: move.promoType, color};
  }

  if (move.castle) {
    const rank = color==='w' ? 7 : 0;
    if (move.castle === 'K') {
      newBrd[rcToIdx(rank,5)] = newBrd[rcToIdx(rank,7)];
      newBrd[rcToIdx(rank,7)] = null;
    } else {
      newBrd[rcToIdx(rank,3)] = newBrd[rcToIdx(rank,0)];
      newBrd[rcToIdx(rank,0)] = null;
    }
  }

  if (type === 'K') {
    newCastle[color+'K'] = false;
    newCastle[color+'Q'] = false;
  }
  if (type === 'R') {
    if (move.from === 63) newCastle['wK'] = false;
    if (move.from === 56) newCastle['wQ'] = false;
    if (move.from === 7)  newCastle['bK'] = false;
    if (move.from === 0)  newCastle['bQ'] = false;
  }
  if (move.to === 63) newCastle['wK'] = false;
  if (move.to === 56) newCastle['wQ'] = false;
  if (move.to === 7)  newCastle['bK'] = false;
  if (move.to === 0)  newCastle['bQ'] = false;

  if (move.doublePush) {
    const dir = color==='w' ? 1 : -1;
    newEP = move.to + dir*8;
  }

  return { board: newBrd, ep: newEP, castle: newCastle, captured };
}

function getLegalMoves(idx, brd, ep, castle) {
  const piece = brd[idx];
  if (!piece) return [];
  const pseudo = getPseudoLegalMoves(idx, brd, ep, castle);
  const legal = [];

  for (const move of pseudo) {
    if (move.castle) {
      const color = piece.color;
      const opp = opponent(color);
      const rank = color==='w' ? 7 : 0;
      const kingIdx = rcToIdx(rank,4);
      if (isSquareAttackedBy(kingIdx, opp, brd)) continue;
      if (move.castle === 'K') {
        if (isSquareAttackedBy(rcToIdx(rank,5), opp, brd)) continue;
        if (isSquareAttackedBy(rcToIdx(rank,6), opp, brd)) continue;
      } else {
        if (isSquareAttackedBy(rcToIdx(rank,3), opp, brd)) continue;
        if (isSquareAttackedBy(rcToIdx(rank,2), opp, brd)) continue;
      }
    }

    const result = applyMove(brd, move, ep, castle);
    const kingSquare = findKing(piece.color, result.board);
    if (kingSquare !== -1 && !isSquareAttackedBy(kingSquare, opponent(piece.color), result.board)) {
      legal.push(move);
    }
  }
  return legal;
}

function getAllLegalMoves(color, brd, ep, castle) {
  const moves = [];
  for (let i=0; i<64; i++) {
    if (brd[i] && brd[i].color===color) {
      moves.push(...getLegalMoves(i, brd, ep, castle));
    }
  }
  return moves;
}

// ============================================================
//  SAN NOTATION
// ============================================================

function toAlgebraic(idx) {
  const {row,col} = idxToRC(idx);
  return 'abcdefgh'[col] + (8-row);
}

function moveToSAN(move, brd, legalMoves) {
  const piece = brd[move.from];
  const {type, color} = piece;
  let san = '';

  if (move.castle) return move.castle==='K' ? 'O-O' : 'O-O-O';

  const dest = toAlgebraic(move.to);
  const isCapture = brd[move.to] || move.enPassant;

  if (type === 'P') {
    if (isCapture) san = 'abcdefgh'[idxToRC(move.from).col] + 'x';
    san += dest;
    if (move.promo && move.promoType) san += '=' + move.promoType;
  } else {
    const sameTypeMoves = legalMoves.filter(m =>
      m.from !== move.from &&
      brd[m.from] && brd[m.from].type === type &&
      brd[m.from].color === color &&
      m.to === move.to
    );
    san = type;
    if (sameTypeMoves.length > 0) {
      const sameCol = sameTypeMoves.filter(m => idxToRC(m.from).col === idxToRC(move.from).col);
      const sameRow = sameTypeMoves.filter(m => idxToRC(m.from).row === idxToRC(move.from).row);
      if (sameCol.length === 0) san += 'abcdefgh'[idxToRC(move.from).col];
      else if (sameRow.length === 0) san += (8-idxToRC(move.from).row);
      else san += toAlgebraic(move.from);
    }
    if (isCapture) san += 'x';
    san += dest;
  }

  return san;
}

// ============================================================
//  UI STATE
// ============================================================

let selectedSq = null;
let legalMovesForSelected = [];
let lastMove = null;

function newGame() {
  initBoard();
  selectedSq = null;
  legalMovesForSelected = [];
  lastMove = null;
  document.getElementById('result-overlay').classList.remove('show');
  document.getElementById('status-turn').style.color = '';
  document.getElementById('status-msg').style.color  = '';
  renderBoard();
  updateUI();
}

function flipBoard() {
  flipped = !flipped;
  renderBoard();
  renderCoords();
}

function undoMove() {
  if (moveHistory.length === 0) return;
  const last = moveHistory.pop();
  board = last.board;
  turn = last.turn;
  enPassantTarget = last.ep;
  castlingRights = last.castle;
  capturedPieces = last.captured;
  lastMove = last.lastMove;
  gameOver = false;
  selectedSq = null;
  legalMovesForSelected = [];

  if (repertoireMode) {
    repError = false;
    if (turn === 'w' && repIndex > 0) repIndex--;
  }

  document.getElementById('result-overlay').classList.remove('show');
  document.getElementById('status-turn').style.color = '';
  document.getElementById('status-msg').style.color  = '';
  renderBoard();
  updateUI();
  renderMoveHistory();
}

function onSquareClick(idx) {
  if (gameOver) return;
  if (pendingPromo) return;
  if (repError) return;

  const piece = board[idx];

  if (selectedSq === null) {
    if (piece && piece.color === turn) {
      selectedSq = idx;
      legalMovesForSelected = getLegalMoves(idx, board, enPassantTarget, castlingRights);
      renderBoard();
    }
  } else {
    const move = legalMovesForSelected.find(m => m.to === idx);
    if (move) {
      if (move.promo) {
        pendingPromo = move;
        showPromoModal(board[move.from].color);
      } else {
        executeMove(move);
      }
    } else if (piece && piece.color === turn) {
      selectedSq = idx;
      legalMovesForSelected = getLegalMoves(idx, board, enPassantTarget, castlingRights);
      renderBoard();
    } else {
      selectedSq = null;
      legalMovesForSelected = [];
      renderBoard();
    }
  }
}

function executeMove(move) {
  moveHistory.push({
    board: [...board],
    turn, ep: enPassantTarget,
    castle: {...castlingRights},
    captured: { w: [...capturedPieces.w], b: [...capturedPieces.b] },
    lastMove: lastMove ? {...lastMove} : null
  });

  const allLegal = getAllLegalMoves(turn, board, enPassantTarget, castlingRights);
  const san = moveToSAN(move, board, allLegal);

  // Repertoire: validate white's move
  if (repertoireMode && turn === 'w') {
    const expected = (repLine['White Moves'][repIndex] || '').replace(/[+#]/g, '');
    const played   = san.replace(/[+#]/g, '');
    if (played !== expected) {
      moveHistory.pop();
      repError = true;
      renderRepProgress();
      return;
    }
    repError = false;
  }

  const result = applyMove(board, move, enPassantTarget, castlingRights);
  board = result.board;
  enPassantTarget = result.ep;
  castlingRights = result.castle;

  if (result.captured) capturedPieces[turn].push(result.captured);

  lastMove = move;
  selectedSq = null;
  legalMovesForSelected = [];

  const prevTurn = turn;
  turn = opponent(turn);

  // Repertoire: auto-play black's response
  if (repertoireMode && prevTurn === 'w') {
    const blackSan = repLine['Black Moves'][repIndex];
    repIndex++;
    if (blackSan) {
      setTimeout(() => {
        const blackMove = sanToMove(blackSan);
        if (blackMove) executeMove(blackMove);
      }, 350);
    } else {
      renderRepProgress();
    }
  }

  const nextMoves = getAllLegalMoves(turn, board, enPassantTarget, castlingRights);
  const kingSquare = findKing(turn, board);
  const inCheck = isSquareAttackedBy(kingSquare, prevTurn, board);

  let finSAN = san;
  if (nextMoves.length === 0) {
    finSAN += inCheck ? '#' : '';
  } else if (inCheck) {
    finSAN += '+';
  }

  moveHistory[moveHistory.length-1].san = finSAN;
  moveHistory[moveHistory.length-1].moveIdx = moveHistory.length-1;

  renderBoard();
  updateUI(nextMoves, inCheck);
  renderMoveHistory();

  if (nextMoves.length === 0) {
    gameOver = true;
    if (inCheck) {
      showResult(`Player ${prevTurn==='w'?'White':'Black'} won`, 'by Checkmate');
    } else {
      showResult('Draw', 'by Stalemate');
    }
  }
}

function showResult(title, sub) {
  const turnEl = document.getElementById('status-turn');
  const msgEl  = document.getElementById('status-msg');
  turnEl.textContent = title;
  turnEl.style.color = '#e74c3c';
  msgEl.textContent  = sub;
  msgEl.style.color  = '#e74c3c';
  document.getElementById('bar-white').classList.remove('active');
  document.getElementById('bar-black').classList.remove('active');
}

// ============================================================
//  REPERTOIRE FUNCTIONS
// ============================================================

function sanToMove(san) {
  const allMoves = getAllLegalMoves(turn, board, enPassantTarget, castlingRights);
  for (const move of allMoves) {
    const moveSan = moveToSAN(move, board, allMoves).replace(/[+#]/g, '');
    if (moveSan === san.replace(/[+#]/g, '')) return move;
  }
  return null;
}

function populateOpenings() {
  const sel = document.getElementById('rep-opening');
  Object.keys(Openings).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
}

function onOpeningChange() {
  const openingName = document.getElementById('rep-opening').value;
  const lineSel = document.getElementById('rep-line');
  lineSel.innerHTML = '<option value="">— Select Line —</option>';
  lineSel.disabled = true;
  document.getElementById('rep-start-btn').disabled = true;
  if (!openingName) return;
  Openings[openingName]['Lines'].forEach((lineObj, i) => {
    const lineName = Object.keys(lineObj)[0];
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = lineName;
    lineSel.appendChild(opt);
  });
  lineSel.disabled = false;
}

function onLineChange() {
  document.getElementById('rep-start-btn').disabled =
    document.getElementById('rep-line').value === '';
}

function startRepertoire() {
  const openingName = document.getElementById('rep-opening').value;
  const lineIdx     = parseInt(document.getElementById('rep-line').value);
  const lineObj     = Openings[openingName]['Lines'][lineIdx];
  const lineName    = Object.keys(lineObj)[0];
  repLine           = lineObj[lineName];
  repIndex          = 0;
  repError          = false;
  repertoireMode    = true;

  document.getElementById('rep-start-btn').style.display = 'none';
  document.getElementById('rep-stop-btn').style.display  = 'block';
  document.getElementById('rep-badge').style.display     = 'inline-block';

  newGame();
  renderRepProgress();
}

function stopRepertoire() {
  repertoireMode = false;
  repLine        = null;
  repIndex       = 0;
  repError       = false;

  document.getElementById('rep-start-btn').style.display = 'block';
  document.getElementById('rep-stop-btn').style.display  = 'none';
  document.getElementById('rep-badge').style.display     = 'none';
  document.getElementById('rep-progress').innerHTML      = '';
  document.getElementById('rep-line').value              = '';
  document.getElementById('rep-start-btn').disabled      = true;
}

function renderRepProgress() {
  const el = document.getElementById('rep-progress');
  if (!repertoireMode || !repLine) { el.innerHTML = ''; return; }

  const totalWhite = repLine['White Moves'].length;

  if (repError) {
    el.innerHTML = `<span class="error">✗ Wrong move — undo and try again</span>`;
  } else if (repIndex >= totalWhite) {
    el.innerHTML = `<span class="done">✓ Line complete! Well done.</span>`;
  } else {
    const expectedW = repLine['White Moves'][repIndex];
    const clue      = (repLine['Clues'] && repLine['Clues'][repIndex]) || '';
    el.innerHTML = `Move ${repIndex + 1} of ${totalWhite}<br>
      Your move: <span class="expected">${expectedW}</span>
      ${clue ? `<div class="clue">${clue}</div>` : ''}`;
  }
}

// ============================================================
//  PROMOTION MODAL
// ============================================================

function showPromoModal(color) {
  const pieces = ['Q','R','B','N'];
  const modal = document.getElementById('promo-modal');
  const container = document.getElementById('promo-pieces');
  container.innerHTML = '';
  pieces.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'promo-btn';
    btn.appendChild(pieceImg(color + t, 52));
    btn.onclick = () => {
      modal.classList.remove('show');
      const m = {...pendingPromo, promoType: t};
      pendingPromo = null;
      executeMove(m);
    };
    container.appendChild(btn);
  });
  modal.classList.add('show');
}

// ============================================================
//  RENDER
// ============================================================

function renderCoords() {
  const ranks = document.getElementById('ranks');
  const files = document.getElementById('files');
  ranks.innerHTML = '';
  files.innerHTML = '';

  const rankLabels = flipped ? ['1','2','3','4','5','6','7','8'] : ['8','7','6','5','4','3','2','1'];
  const fileLabels = flipped ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h'];

  rankLabels.forEach(r => {
    const span = document.createElement('span');
    span.textContent = r;
    ranks.appendChild(span);
  });
  fileLabels.forEach(f => {
    const span = document.createElement('span');
    span.textContent = f;
    files.appendChild(span);
  });
}

function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.querySelectorAll('.sq').forEach(s => s.remove());

  const legalTos = new Set(legalMovesForSelected.map(m => m.to));
  const kingSquare = findKing(turn, board);
  const inCheck = !gameOver && kingSquare !== -1 && isSquareAttackedBy(kingSquare, opponent(turn), board);

  for (let display = 0; display < 64; display++) {
    const idx = flipped ? (63 - display) : display;
    const {row, col} = idxToRC(idx);
    const isLight = (row+col)%2 === 0;
    const piece = board[idx];

    const sq = document.createElement('div');
    sq.className = 'sq ' + (isLight ? 'light' : 'dark');
    sq.dataset.idx = idx;

    if (lastMove && (idx === lastMove.from || idx === lastMove.to)) sq.classList.add('last-move');
    if (selectedSq === idx) sq.classList.add('selected');
    if (legalTos.has(idx)) {
      sq.classList.add('highlight');
      if (piece || legalMovesForSelected.find(m=>m.to===idx && m.enPassant)) {
        sq.classList.add('capture');
      }
    }
    if (inCheck && piece && piece.type==='K' && piece.color===turn) sq.classList.add('in-check');

    if (piece) {
      const img = pieceImg(piece.color + piece.type, 58);
      img.className = 'piece';
      sq.appendChild(img);
    }

    sq.addEventListener('click', () => onSquareClick(idx));
    boardEl.appendChild(sq);
  }
}

function updateUI(nextMoves, inCheck) {
  const turnEl = document.getElementById('status-turn');
  const msgEl  = document.getElementById('status-msg');

  turnEl.textContent = (turn==='w'?'White':'Black') + ' to move';

  if (inCheck && nextMoves && nextMoves.length > 0) {
    msgEl.textContent = '⚠ Check!';
    msgEl.style.color = '#e74c3c';
  } else {
    msgEl.textContent = '';
    msgEl.style.color = '';
  }

  document.getElementById('bar-white').classList.toggle('active', turn==='w');
  document.getElementById('bar-black').classList.toggle('active', turn==='b');

  const renderCaptured = (color, targetId) => {
    const el = document.getElementById(targetId);
    el.innerHTML = '';
    capturedPieces[color]
      .sort((a,b) => PIECE_VALUES[b.type]-PIECE_VALUES[a.type])
      .forEach(p => {
        const img = pieceImg(p.color + p.type, 20);
        img.style.width = '20px';
        img.style.height = '20px';
        el.appendChild(img);
      });
  };
  renderCaptured('w', 'cap-white');
  renderCaptured('b', 'cap-black');

  renderRepProgress();
}

function renderMoveHistory() {
  const el = document.getElementById('move-history');
  el.innerHTML = '';

  const moves = moveHistory.filter(m => m.san);
  for (let i=0; i<moves.length; i+=2) {
    const pair = document.createElement('div');
    pair.className = 'move-pair';

    const num = document.createElement('span');
    num.className = 'move-num';
    num.textContent = (Math.floor(i/2)+1) + '.';
    pair.appendChild(num);

    const m1 = document.createElement('span');
    m1.className = 'move-san' + (i===moves.length-1?' current':'');
    m1.textContent = moves[i].san;
    pair.appendChild(m1);

    if (moves[i+1]) {
      const m2 = document.createElement('span');
      m2.className = 'move-san' + (i+1===moves.length-1?' current':'');
      m2.textContent = moves[i+1].san;
      pair.appendChild(m2);
    }

    el.appendChild(pair);
  }
  el.scrollTop = el.scrollHeight;
}

// ============================================================
//  INIT
// ============================================================

renderCoords();
populateOpenings();
buildStylePanel();
applyBoardTheme("Walnut");
newGame();

// ============================================================
//  STYLE PANEL
// ============================================================

function toggleStylePanel() {
  const panel   = document.getElementById('style-panel');
  const tab     = document.getElementById('style-tab');
  const overlay = document.getElementById('style-overlay');
  const isOpen  = panel.classList.toggle('open');
  tab.classList.toggle('open', isOpen);
  overlay.classList.toggle('show', isOpen);
}

function closeStylePanel() {
  document.getElementById('style-panel').classList.remove('open');
  document.getElementById('style-tab').classList.remove('open');
  document.getElementById('style-overlay').classList.remove('show');
}

function buildStylePanel() {
  // ── Piece sets ────────────────────────────────────────────
  const psGrid = document.getElementById('piece-set-grid');
  Object.keys(PIECE_SETS).forEach(name => {
    const card = document.createElement('div');
    card.className = 'piece-set-card' + (name === currentPieceSet ? ' active' : '');
    card.onclick = () => selectPieceSet(name);
    card.id = `pset-${name}`;

    // preview: show king + queen of each color
    const preview = document.createElement('div');
    preview.className = 'piece-set-preview';
    ['wK','wQ','bK','bQ'].forEach(ct => {
      const img = document.createElement('img');
      img.src = `${PIECE_SETS[name]}/${ct[0]==='w'?'King_W':'King_B'}.png`;
      // use correct piece
      const fileMap = { wK:'King_W', wQ:'Queen_W', bK:'King_B', bQ:'Queen_B' };
      img.src = `${PIECE_SETS[name]}/${fileMap[ct]}.png`;
      img.width = 26; img.height = 26; img.draggable = false;
      preview.appendChild(img);
    });

    const label = document.createElement('div');
    label.className = 'piece-set-name';
    label.textContent = name;

    card.appendChild(preview);
    card.appendChild(label);
    psGrid.appendChild(card);
  });

  // ── Board themes ──────────────────────────────────────────
  const btGrid = document.getElementById('board-theme-grid');
  Object.entries(BOARD_THEMES).forEach(([name, theme]) => {
    const card = document.createElement('div');
    card.className = 'board-theme-card' + (name === currentBoardTheme ? ' active' : '');
    card.onclick = () => selectBoardTheme(name);
    card.id = `btheme-${name}`;

    // 2x2 swatch
    const swatch = document.createElement('div');
    swatch.className = 'board-theme-swatch';
    [theme.light, theme.dark, theme.dark, theme.light].forEach(color => {
      const sq = document.createElement('div');
      sq.className = 'swatch-sq';
      sq.style.background = color;
      swatch.appendChild(sq);
    });

    const lbl = document.createElement('div');
    lbl.className = 'board-theme-label';
    lbl.textContent = name;

    card.appendChild(swatch);
    card.appendChild(lbl);
    btGrid.appendChild(card);
  });

  // ── Overlay to close on outside click ────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'style-overlay';
  overlay.id = 'style-overlay';
  overlay.onclick = closeStylePanel;
  document.body.appendChild(overlay);
}

function selectPieceSet(name) {
  if (!PIECE_SETS[name]) return;
  currentPieceSet = name;

  // Update active card
  document.querySelectorAll('.piece-set-card').forEach(c => c.classList.remove('active'));
  document.getElementById(`pset-${name}`).classList.add('active');

  // Update avatars
  document.getElementById('avatar-white').src = getPieceImg('wK');
  document.getElementById('avatar-black').src = getPieceImg('bK');

  // Re-render board with new pieces
  renderBoard();
  // Re-render captured pieces
  updateUI();
}

function selectBoardTheme(name) {
  if (!BOARD_THEMES[name]) return;
  applyBoardTheme(name);
}

function applyBoardTheme(name) {
  const theme = BOARD_THEMES[name];
  if (!theme) return;
  currentBoardTheme = name;

  // Remove all theme classes
  Object.values(BOARD_THEMES).forEach(t =>
    document.body.classList.remove(t.cls)
  );
  document.body.classList.add(theme.cls);

  // Update active card
  document.querySelectorAll('.board-theme-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById(`btheme-${name}`);
  if (card) card.classList.add('active');

  renderBoard();
}
