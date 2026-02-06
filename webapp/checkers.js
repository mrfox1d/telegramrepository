// Шашки (Русские)
let checkersBoard = [];
let selectedChecker = null;
let validCheckersMove = [];
let mustCapture = false;

const INITIAL_CHECKERS_POSITION = [
    [' ', 'b', ' ', 'b', ' ', 'b', ' ', 'b'],
    ['b', ' ', 'b', ' ', 'b', ' ', 'b', ' '],
    [' ', 'b', ' ', 'b', ' ', 'b', ' ', 'b'],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    ['w', ' ', 'w', ' ', 'w', ' ', 'w', ' '],
    [' ', 'w', ' ', 'w', ' ', 'w', ' ', 'w'],
    ['w', ' ', 'w', ' ', 'w', ' ', 'w', ' ']
];

function initCheckersBoard(container) {
    checkersBoard = JSON.parse(JSON.stringify(INITIAL_CHECKERS_POSITION));
    
    container.className = 'game-board';
    container.innerHTML = '<div class="checkers-board" id="checkers-board"></div>';
    
    renderCheckersBoard();
}

function renderCheckersBoard() {
    const boardElement = document.getElementById('checkers-board');
    boardElement.innerHTML = '';
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.className = 'checkers-cell';
            cell.className += (row + col) % 2 === 0 ? ' white' : ' black';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            const piece = checkersBoard[row][col];
            if (piece !== ' ') {
                const checkerPiece = document.createElement('div');
                checkerPiece.className = 'checker-piece';
                
                if (piece === 'w' || piece === 'W') {
                    checkerPiece.classList.add('white');
                } else {
                    checkerPiece.classList.add('black');
                }
                
                // Дамка
                if (piece === piece.toUpperCase() && piece !== ' ') {
                    checkerPiece.classList.add('king');
                }
                
                // Выбранная шашка
                if (selectedChecker && selectedChecker.row === row && selectedChecker.col === col) {
                    checkerPiece.classList.add('selected');
                }
                
                cell.appendChild(checkerPiece);
            }
            
            // Возможные ходы
            if (validCheckersMove.some(move => move.row === row && move.col === col)) {
                cell.classList.add('valid-move');
            }
            
            cell.onclick = () => handleCheckersClick(row, col);
            
            boardElement.appendChild(cell);
        }
    }
}

function handleCheckersClick(row, col) {
    const piece = checkersBoard[row][col];
    
    // Если уже выбрана шашка и кликнули на валидный ход
    if (selectedChecker && validCheckersMove.some(move => move.row === row && move.col === col)) {
        const move = validCheckersMove.find(m => m.row === row && m.col === col);
        makeCheckersMove(selectedChecker.row, selectedChecker.col, row, col, move.captures);
        selectedChecker = null;
        validCheckersMove = [];
        renderCheckersBoard();
        return;
    }
    
    // Выбор новой шашки (только свои)
    if (piece !== ' ' && isMyChecker(piece)) {
        selectedChecker = { row, col };
        validCheckersMove = calculateCheckersMove(row, col, piece);
        renderCheckersBoard();
        tg.HapticFeedback.impactOccurred('light');
    } else {
        selectedChecker = null;
        validCheckersMove = [];
        renderCheckersBoard();
    }
}

function isMyChecker(piece) {
    // Белые играют снизу
    const isWhiteTurn = gameState?.currentPlayer === gameState?.player1?.id;
    const pieceColor = piece.toLowerCase();
    return isWhiteTurn ? pieceColor === 'w' : pieceColor === 'b';
}

function calculateCheckersMove(row, col, piece) {
    const moves = [];
    const isKing = piece === piece.toUpperCase();
    const isWhite = piece.toLowerCase() === 'w';
    
    // Проверяем обязательные взятия
    const captures = findCaptures(row, col, piece, isKing, isWhite);
    
    if (captures.length > 0) {
        mustCapture = true;
        return captures;
    }
    
    // Обычные ходы (если нет обязательных взятий)
    mustCapture = false;
    
    if (isKing) {
        // Дамка ходит во все диагонали
        const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (isValidCheckerSquare(newRow, newCol) && checkersBoard[newRow][newCol] === ' ') {
                moves.push({ row: newRow, col: newCol, captures: [] });
            }
        }
    } else {
        // Обычная шашка ходит только вперед
        const direction = isWhite ? -1 : 1;
        const moveDirs = [[direction, -1], [direction, 1]];
        
        for (const [dr, dc] of moveDirs) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (isValidCheckerSquare(newRow, newCol) && checkersBoard[newRow][newCol] === ' ') {
                moves.push({ row: newRow, col: newCol, captures: [] });
            }
        }
    }
    
    return moves;
}

function findCaptures(row, col, piece, isKing, isWhite) {
    const captures = [];
    const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    
    for (const [dr, dc] of directions) {
        // Если не дамка и направление назад - пропускаем
        if (!isKing) {
            if ((isWhite && dr > 0) || (!isWhite && dr < 0)) {
                continue;
            }
        }
        
        const jumpRow = row + dr;
        const jumpCol = col + dc;
        const landRow = row + 2 * dr;
        const landCol = col + 2 * dc;
        
        // Проверяем возможность взятия
        if (isValidCheckerSquare(jumpRow, jumpCol) && 
            isValidCheckerSquare(landRow, landCol)) {
            
            const jumpPiece = checkersBoard[jumpRow][jumpCol];
            const landPiece = checkersBoard[landRow][landCol];
            
            // Если через клетку шашка противника и место приземления пусто
            if (jumpPiece !== ' ' && 
                isOpponentChecker(jumpPiece, piece) && 
                landPiece === ' ') {
                
                captures.push({
                    row: landRow,
                    col: landCol,
                    captures: [{ row: jumpRow, col: jumpCol }]
                });
            }
        }
    }
    
    return captures;
}

function isValidCheckerSquare(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function isOpponentChecker(target, myPiece) {
    if (target === ' ') return false;
    return target.toLowerCase() !== myPiece.toLowerCase();
}

function makeCheckersMove(fromRow, fromCol, toRow, toCol, captures) {
    let piece = checkersBoard[fromRow][fromCol];
    
    // Убираем взятые шашки
    if (captures && captures.length > 0) {
        captures.forEach(capture => {
            checkersBoard[capture.row][capture.col] = ' ';
        });
    }
    
    // Превращение в дамку
    if (piece === 'w' && toRow === 0) {
        piece = 'W';
    } else if (piece === 'b' && toRow === 7) {
        piece = 'B';
    }
    
    // Перемещаем шашку
    checkersBoard[toRow][toCol] = piece;
    checkersBoard[fromRow][fromCol] = ' ';
    
    // Отправляем ход на сервер
    sendGameAction('move', {
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        captures: captures,
        board: checkersBoard
    });
    
    tg.HapticFeedback.impactOccurred('medium');
}

function handleCheckersMove(move) {
    checkersBoard = move.board;
    renderCheckersBoard();
}