// Шахматы
const CHESS_PIECES = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',  // Белые
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'   // Черные
};

let chessBoard = [];
let selectedPiece = null;
let validMoves = [];

// Начальная позиция
const INITIAL_CHESS_POSITION = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

function initChessBoard(container) {
    chessBoard = JSON.parse(JSON.stringify(INITIAL_CHESS_POSITION));
    
    container.className = 'game-board';
    container.innerHTML = '<div class="chess-board" id="chess-board"></div>';
    
    renderChessBoard();
}

function renderChessBoard() {
    const boardElement = document.getElementById('chess-board');
    boardElement.innerHTML = '';
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.className = 'chess-cell';
            cell.className += (row + col) % 2 === 0 ? ' white' : ' black';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            const piece = chessBoard[row][col];
            if (piece !== ' ') {
                cell.textContent = CHESS_PIECES[piece];
            }
            
            // Проверяем, является ли клетка выбранной
            if (selectedPiece && selectedPiece.row === row && selectedPiece.col === col) {
                cell.classList.add('selected');
            }
            
            // Проверяем, является ли клетка возможным ходом
            if (validMoves.some(move => move.row === row && move.col === col)) {
                cell.classList.add('valid-move');
            }
            
            cell.onclick = () => handleChessClick(row, col);
            
            boardElement.appendChild(cell);
        }
    }
}

function handleChessClick(row, col) {
    const piece = chessBoard[row][col];
    
    // Если уже выбрана фигура и кликнули на валидный ход
    if (selectedPiece && validMoves.some(move => move.row === row && move.col === col)) {
        makeChessMove(selectedPiece.row, selectedPiece.col, row, col);
        selectedPiece = null;
        validMoves = [];
        renderChessBoard();
        return;
    }
    
    // Выбор новой фигуры (только свои фигуры)
    if (piece !== ' ' && isMyPiece(piece)) {
        selectedPiece = { row, col };
        validMoves = calculateValidMoves(row, col, piece);
        renderChessBoard();
        tg.HapticFeedback.impactOccurred('light');
    } else {
        selectedPiece = null;
        validMoves = [];
        renderChessBoard();
    }
}

function isMyPiece(piece) {
    // Белые играют снизу (заглавные буквы)
    const isWhiteTurn = gameState?.currentPlayer === gameState?.player1?.id;
    return isWhiteTurn ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
}

function calculateValidMoves(row, col, piece) {
    const moves = [];
    const type = piece.toLowerCase();
    
    switch (type) {
        case 'p':
            moves.push(...getPawnMoves(row, col, piece));
            break;
        case 'r':
            moves.push(...getRookMoves(row, col, piece));
            break;
        case 'n':
            moves.push(...getKnightMoves(row, col, piece));
            break;
        case 'b':
            moves.push(...getBishopMoves(row, col, piece));
            break;
        case 'q':
            moves.push(...getQueenMoves(row, col, piece));
            break;
        case 'k':
            moves.push(...getKingMoves(row, col, piece));
            break;
    }
    
    return moves;
}

function getPawnMoves(row, col, piece) {
    const moves = [];
    const direction = piece === piece.toUpperCase() ? -1 : 1;
    const startRow = piece === piece.toUpperCase() ? 6 : 1;
    
    // Движение вперед
    if (isValidSquare(row + direction, col) && chessBoard[row + direction][col] === ' ') {
        moves.push({ row: row + direction, col });
        
        // Двойной ход с начальной позиции
        if (row === startRow && chessBoard[row + 2 * direction][col] === ' ') {
            moves.push({ row: row + 2 * direction, col });
        }
    }
    
    // Взятие по диагонали
    for (const dc of [-1, 1]) {
        if (isValidSquare(row + direction, col + dc)) {
            const target = chessBoard[row + direction][col + dc];
            if (target !== ' ' && isOpponentPiece(target, piece)) {
                moves.push({ row: row + direction, col: col + dc });
            }
        }
    }
    
    return moves;
}

function getRookMoves(row, col, piece) {
    const moves = [];
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    
    for (const [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        
        while (isValidSquare(r, c)) {
            const target = chessBoard[r][c];
            
            if (target === ' ') {
                moves.push({ row: r, col: c });
            } else {
                if (isOpponentPiece(target, piece)) {
                    moves.push({ row: r, col: c });
                }
                break;
            }
            
            r += dr;
            c += dc;
        }
    }
    
    return moves;
}

function getKnightMoves(row, col, piece) {
    const moves = [];
    const offsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    
    for (const [dr, dc] of offsets) {
        const r = row + dr;
        const c = col + dc;
        
        if (isValidSquare(r, c)) {
            const target = chessBoard[r][c];
            if (target === ' ' || isOpponentPiece(target, piece)) {
                moves.push({ row: r, col: c });
            }
        }
    }
    
    return moves;
}

function getBishopMoves(row, col, piece) {
    const moves = [];
    const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    
    for (const [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        
        while (isValidSquare(r, c)) {
            const target = chessBoard[r][c];
            
            if (target === ' ') {
                moves.push({ row: r, col: c });
            } else {
                if (isOpponentPiece(target, piece)) {
                    moves.push({ row: r, col: c });
                }
                break;
            }
            
            r += dr;
            c += dc;
        }
    }
    
    return moves;
}

function getQueenMoves(row, col, piece) {
    return [...getRookMoves(row, col, piece), ...getBishopMoves(row, col, piece)];
}

function getKingMoves(row, col, piece) {
    const moves = [];
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];
    
    for (const [dr, dc] of directions) {
        const r = row + dr;
        const c = col + dc;
        
        if (isValidSquare(r, c)) {
            const target = chessBoard[r][c];
            if (target === ' ' || isOpponentPiece(target, piece)) {
                moves.push({ row: r, col: c });
            }
        }
    }
    
    return moves;
}

function isValidSquare(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function isOpponentPiece(target, myPiece) {
    if (target === ' ') return false;
    return (myPiece === myPiece.toUpperCase()) !== (target === target.toUpperCase());
}

function makeChessMove(fromRow, fromCol, toRow, toCol) {
    const piece = chessBoard[fromRow][fromCol];
    chessBoard[toRow][toCol] = piece;
    chessBoard[fromRow][fromCol] = ' ';
    
    // Отправляем ход на сервер
    sendGameAction('move', {
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        board: chessBoard
    });
    
    tg.HapticFeedback.impactOccurred('medium');
}

function handleChessMove(move) {
    chessBoard = move.board;
    renderChessBoard();
}