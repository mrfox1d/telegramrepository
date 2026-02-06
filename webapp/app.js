// Инициализация Telegram Web App
let tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// Глобальные переменные
let currentUser = null;
let currentGame = null;
let selectedGameType = null;
let ws = null;
let gameState = null;

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    initTelegramUser();
    await loadUserData();
    connectWebSocket();
    loadActiveGames();
});

// Получение данных пользователя из Telegram
function initTelegramUser() {
    const user = tg.initDataUnsafe.user;
    if (user) {
        currentUser = {
            id: user.id,
            username: user.username || user.first_name,
            firstName: user.first_name,
            lastName: user.last_name
        };
        
        document.getElementById('username').textContent = currentUser.username;
    } else {
        // Для тестирования без Telegram
        currentUser = {
            id: Math.floor(Math.random() * 1000000),
            username: 'TestUser',
            firstName: 'Test',
            lastName: 'User'
        };
    }
}

// Загрузка данных пользователя с сервера
async function loadUserData() {
    try {
        const response = await fetch(`/api/users/${currentUser.id}`);
        if (response.ok) {
            const data = await response.json();
            document.getElementById('wins').textContent = data.wins || 0;
            document.getElementById('rating').textContent = data.rating || 1000;
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

// WebSocket соединение для реального времени
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:8000';
    ws = new WebSocket(`${protocol}//${host}/ws/${currentUser.id}`);
    
    ws.onopen = () => {
        console.log('WebSocket подключен');
    };
    
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket ошибка:', error);
    };
    
    ws.onclose = () => {
        console.log('WebSocket отключен');
        // Переподключение через 3 секунды
        setTimeout(connectWebSocket, 3000);
    };
}

// Обработка сообщений WebSocket
function handleWebSocketMessage(message) {
    switch (message.type) {
        case 'game_started':
            startGameSession(message.game);
            break;
        case 'opponent_move':
            handleOpponentMove(message.move);
            break;
        case 'game_update':
            updateGameState(message.state);
            break;
        case 'game_ended':
            showGameResult(message.result);
            break;
        case 'chat_message':
            addChatMessage(message.sender, message.text);
            break;
        case 'opponent_left':
            handleOpponentLeft();
            break;
    }
}

// Навигация между экранами
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
    
    tg.HapticFeedback.impactOccurred('light');
}

// Выбор игры
function selectGame(gameType) {
    selectedGameType = gameType;
    
    const titles = {
        'chess': '♟️ Шахматы',
        'checkers': '⚫ Шашки',
        'rps': '✊ Камень, ножницы, бумага'
    };
    
    document.getElementById('game-title').textContent = titles[gameType];
    showScreen('mode-select');
}

// Создание новой игры
async function createGame() {
    try {
        const response = await fetch('/api/games/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                gameType: selectedGameType
            })
        });
        
        const data = await response.json();
        currentGame = data.gameId;
        
        // Показываем код игры
        document.getElementById('game-code').textContent = data.code;
        document.getElementById('game-code-display').style.display = 'block';
        
        showScreen('waiting-screen');
        
        tg.HapticFeedback.notificationOccurred('success');
    } catch (error) {
        console.error('Ошибка создания игры:', error);
        tg.showAlert('Ошибка создания игры');
    }
}

// Поиск случайной игры
async function findGame() {
    try {
        const response = await fetch('/api/games/find', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                gameType: selectedGameType
            })
        });
        
        const data = await response.json();
        currentGame = data.gameId;
        
        showScreen('waiting-screen');
        
        tg.HapticFeedback.notificationOccurred('success');
    } catch (error) {
        console.error('Ошибка поиска игры:', error);
        tg.showAlert('Ошибка поиска игры');
    }
}

// Присоединение по коду
function joinByCode() {
    tg.showPopup({
        title: 'Введите код игры',
        message: 'Код состоит из 4 символов',
        buttons: [
            {id: 'cancel', type: 'cancel'},
            {id: 'join', type: 'default', text: 'Присоединиться'}
        ]
    }, async (buttonId) => {
        if (buttonId === 'join') {
            // В реальности здесь будет input
            const code = prompt('Введите код:');
            if (code) {
                await joinGameByCode(code);
            }
        }
    });
}

async function joinGameByCode(code) {
    try {
        const response = await fetch('/api/games/join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                code: code.toUpperCase()
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            currentGame = data.gameId;
            startGameSession(data.game);
        } else {
            tg.showAlert('Игра не найдена');
        }
    } catch (error) {
        console.error('Ошибка подключения:', error);
        tg.showAlert('Ошибка подключения к игре');
    }
}

// Копирование кода игры
function copyCode() {
    const code = document.getElementById('game-code').textContent;
    navigator.clipboard.writeText(code);
    tg.showPopup({
        message: 'Код скопирован!'
    });
    tg.HapticFeedback.notificationOccurred('success');
}

// Поделиться игрой
function shareGame() {
    const code = document.getElementById('game-code').textContent;
    const url = `https://t.me/${tg.initDataUnsafe.bot?.username}?startapp=${code}`;
    
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=Сыграем%20в%20${selectedGameType}!`);
}

// Отмена ожидания
async function cancelWaiting() {
    if (currentGame) {
        try {
            await fetch(`/api/games/${currentGame}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: currentUser.id
                })
            });
        } catch (error) {
            console.error('Ошибка отмены:', error);
        }
    }
    
    currentGame = null;
    showScreen('main-menu');
}

// Начало игровой сессии
function startGameSession(game) {
    gameState = game;
    
    // Устанавливаем имена игроков
    document.getElementById('player1-name').textContent = 
        game.player1.id === currentUser.id ? 'Вы' : game.player1.username;
    document.getElementById('player2-name').textContent = 
        game.player2.id === currentUser.id ? 'Вы' : game.player2.username;
    
    // Загружаем соответствующую игру
    loadGameBoard(game.type);
    
    showScreen('game-screen');
    
    tg.HapticFeedback.notificationOccurred('success');
}

// Загрузка игрового поля
function loadGameBoard(gameType) {
    const boardContainer = document.getElementById('game-board');
    
    switch (gameType) {
        case 'chess':
            initChessBoard(boardContainer);
            break;
        case 'checkers':
            initCheckersBoard(boardContainer);
            break;
        case 'rps':
            initRPSBoard(boardContainer);
            break;
    }
}

// Обработка хода оппонента
function handleOpponentMove(move) {
    if (selectedGameType === 'chess') {
        handleChessMove(move);
    } else if (selectedGameType === 'checkers') {
        handleCheckersMove(move);
    } else if (selectedGameType === 'rps') {
        handleRPSMove(move);
    }
    
    updateTurnIndicator();
    tg.HapticFeedback.impactOccurred('medium');
}

// Обновление индикатора хода
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    const isMyTurn = gameState.currentPlayer === currentUser.id;
    
    indicator.textContent = isMyTurn ? 'Ваш ход' : 'Ход соперника';
    indicator.style.background = isMyTurn ? 'var(--success)' : 'var(--tg-hint)';
}

// Предложить ничью
function offerDraw() {
    tg.showPopup({
        title: 'Предложить ничью?',
        message: 'Соперник получит предложение',
        buttons: [
            {id: 'cancel', type: 'cancel'},
            {id: 'offer', type: 'default', text: 'Предложить'}
        ]
    }, (buttonId) => {
        if (buttonId === 'offer') {
            sendGameAction('offer_draw');
        }
    });
}

// Сдаться
function resign() {
    tg.showPopup({
        title: 'Сдаться?',
        message: 'Вы проиграете эту партию',
        buttons: [
            {id: 'cancel', type: 'cancel'},
            {id: 'resign', type: 'destructive', text: 'Сдаться'}
        ]
    }, (buttonId) => {
        if (buttonId === 'resign') {
            sendGameAction('resign');
        }
    });
}

// Выход из игры
function leaveGame() {
    tg.showPopup({
        title: 'Выйти из игры?',
        message: 'Это будет засчитано как поражение',
        buttons: [
            {id: 'cancel', type: 'cancel'},
            {id: 'leave', type: 'destructive', text: 'Выйти'}
        ]
    }, (buttonId) => {
        if (buttonId === 'leave') {
            sendGameAction('leave');
            currentGame = null;
            showScreen('main-menu');
        }
    });
}

// Отправка игрового действия
function sendGameAction(action, data = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'game_action',
            gameId: currentGame,
            userId: currentUser.id,
            action: action,
            data: data
        }));
    }
}

// Отправка сообщения в чат
function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    
    if (text && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'chat_message',
            gameId: currentGame,
            userId: currentUser.id,
            text: text
        }));
        
        input.value = '';
        tg.HapticFeedback.impactOccurred('light');
    }
}

// Добавление сообщения в чат
function addChatMessage(sender, text) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    const senderSpan = document.createElement('span');
    senderSpan.className = 'sender';
    senderSpan.textContent = sender === currentUser.username ? 'Вы:' : `${sender}:`;
    
    messageDiv.appendChild(senderSpan);
    messageDiv.appendChild(document.createTextNode(text));
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Обработка выхода соперника
function handleOpponentLeft() {
    tg.showAlert('Соперник покинул игру');
    showGameResult({
        winner: currentUser.id,
        reason: 'opponent_left'
    });
}

// Показ результата игры
function showGameResult(result) {
    const isWinner = result.winner === currentUser.id;
    const isDraw = result.winner === 'draw';
    
    const resultIcon = document.getElementById('result-icon');
    const resultTitle = document.getElementById('result-title');
    const resultDesc = document.getElementById('result-description');
    const ratingChange = document.getElementById('rating-change');
    
    if (isDraw) {
        resultIcon.textContent = '🤝';
        resultTitle.textContent = 'Ничья';
        resultDesc.textContent = 'Хорошая игра!';
        ratingChange.textContent = '0';
    } else if (isWinner) {
        resultIcon.textContent = '🏆';
        resultTitle.textContent = 'Победа!';
        resultDesc.textContent = 'Поздравляем!';
        ratingChange.textContent = `+${result.ratingChange || 25}`;
        ratingChange.classList.remove('negative');
    } else {
        resultIcon.textContent = '😔';
        resultTitle.textContent = 'Поражение';
        resultDesc.textContent = 'В следующий раз повезет!';
        ratingChange.textContent = `-${result.ratingChange || 15}`;
        ratingChange.classList.add('negative');
    }
    
    document.getElementById('game-duration').textContent = 
        formatDuration(result.duration || 0);
    
    showScreen('result-screen');
    
    tg.HapticFeedback.notificationOccurred(isWinner ? 'success' : 'error');
}

// Реванш
function rematch() {
    tg.showPopup({
        title: 'Предложить реванш?',
        message: 'Соперник получит приглашение',
        buttons: [
            {id: 'cancel', type: 'cancel'},
            {id: 'rematch', type: 'default', text: 'Предложить'}
        ]
    }, (buttonId) => {
        if (buttonId === 'rematch') {
            createGame();
        }
    });
}

// Загрузка активных игр
async function loadActiveGames() {
    try {
        const response = await fetch(`/api/users/${currentUser.id}/games`);
        if (response.ok) {
            const games = await response.json();
            displayActiveGames(games);
        }
    } catch (error) {
        console.error('Ошибка загрузки игр:', error);
    }
}

// Отображение активных игр
function displayActiveGames(games) {
    const container = document.getElementById('games-list');
    
    if (games.length === 0) {
        container.innerHTML = '<p class="empty-state">Нет активных игр</p>';
        return;
    }
    
    container.innerHTML = '';
    
    games.forEach(game => {
        const gameItem = document.createElement('div');
        gameItem.className = 'game-item';
        gameItem.onclick = () => resumeGame(game.id);
        
        const gameIcons = {
            'chess': '♟️',
            'checkers': '⚫',
            'rps': '✊'
        };
        
        gameItem.innerHTML = `
            <div class="game-item-info">
                <div class="game-item-name">${gameIcons[game.type]} ${game.opponentName}</div>
                <div class="game-item-status">${game.status}</div>
            </div>
            <div>▶️</div>
        `;
        
        container.appendChild(gameItem);
    });
}

// Возобновление игры
async function resumeGame(gameId) {
    try {
        const response = await fetch(`/api/games/${gameId}`);
        if (response.ok) {
            const game = await response.json();
            currentGame = gameId;
            selectedGameType = game.type;
            startGameSession(game);
        }
    } catch (error) {
        console.error('Ошибка загрузки игры:', error);
    }
}

// Вспомогательные функции
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Обработка нажатия Enter в чате
document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});