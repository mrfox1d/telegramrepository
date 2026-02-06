// Камень, Ножницы, Бумага
let rpsChoice = null;
let opponentChoice = null;
let rpsRound = 1;
let rpsScore = { player: 0, opponent: 0 };

const RPS_CHOICES = {
    'rock': '✊',
    'paper': '✋',
    'scissors': '✌️'
};

function initRPSBoard(container) {
    rpsChoice = null;
    opponentChoice = null;
    rpsRound = 1;
    rpsScore = { player: 0, opponent: 0 };
    
    container.className = 'game-board';
    container.innerHTML = `
        <div class="rps-container">
            <div class="rps-score">
                <div class="score-item">
                    <span class="score-label">Вы</span>
                    <span class="score-value" id="player-score">0</span>
                </div>
                <div class="score-divider">:</div>
                <div class="score-item">
                    <span class="score-label">Оппонент</span>
                    <span class="score-value" id="opponent-score">0</span>
                </div>
            </div>
            
            <div class="rps-round">Раунд <span id="round-number">1</span></div>
            
            <div class="rps-result" id="rps-result">
                <div id="opponent-choice-display">❓</div>
            </div>
            
            <div class="rps-status" id="rps-status">Выберите ваш ход</div>
            
            <div class="rps-choices">
                <div class="rps-choice" data-choice="rock" onclick="selectRPS('rock')">
                    ${RPS_CHOICES.rock}
                </div>
                <div class="rps-choice" data-choice="paper" onclick="selectRPS('paper')">
                    ${RPS_CHOICES.paper}
                </div>
                <div class="rps-choice" data-choice="scissors" onclick="selectRPS('scissors')">
                    ${RPS_CHOICES.scissors}
                </div>
            </div>
            
            <div class="rps-timer">
                <div class="timer-bar" id="timer-bar"></div>
            </div>
        </div>
    `;
    
    renderRPSBoard();
    startRPSTimer();
}

function renderRPSBoard() {
    // Обновляем счет
    document.getElementById('player-score').textContent = rpsScore.player;
    document.getElementById('opponent-score').textContent = rpsScore.opponent;
    document.getElementById('round-number').textContent = rpsRound;
    
    // Обновляем выбранный элемент
    document.querySelectorAll('.rps-choice').forEach(choice => {
        choice.classList.remove('selected');
    });
    
    if (rpsChoice) {
        const selectedElement = document.querySelector(`[data-choice="${rpsChoice}"]`);
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
    }
}

function selectRPS(choice) {
    if (rpsChoice) {
        // Уже сделан выбор в этом раунде
        tg.showPopup({
            message: 'Вы уже сделали выбор! Ожидайте результата.'
        });
        return;
    }
    
    rpsChoice = choice;
    renderRPSBoard();
    
    document.getElementById('rps-status').textContent = 'Ожидание соперника...';
    
    // Отправляем выбор на сервер
    sendGameAction('rps_choice', {
        choice: choice,
        round: rpsRound
    });
    
    tg.HapticFeedback.impactOccurred('medium');
}

function handleRPSMove(move) {
    opponentChoice = move.choice;
    
    // Показываем результат
    displayRPSResult();
}

function displayRPSResult() {
    if (!rpsChoice || !opponentChoice) return;
    
    const result = determineRPSWinner(rpsChoice, opponentChoice);
    
    // Обновляем отображение выбора оппонента
    document.getElementById('opponent-choice-display').textContent = RPS_CHOICES[opponentChoice];
    
    // Обновляем статус
    const statusElement = document.getElementById('rps-status');
    let statusText = '';
    let statusColor = '';
    
    if (result === 'win') {
        statusText = 'Вы победили! 🎉';
        statusColor = 'var(--success)';
        rpsScore.player++;
        tg.HapticFeedback.notificationOccurred('success');
    } else if (result === 'lose') {
        statusText = 'Вы проиграли 😔';
        statusColor = 'var(--danger)';
        rpsScore.opponent++;
        tg.HapticFeedback.notificationOccurred('error');
    } else {
        statusText = 'Ничья! 🤝';
        statusColor = 'var(--warning)';
        tg.HapticFeedback.notificationOccurred('warning');
    }
    
    statusElement.textContent = statusText;
    statusElement.style.color = statusColor;
    
    // Обновляем счет
    document.getElementById('player-score').textContent = rpsScore.player;
    document.getElementById('opponent-score').textContent = rpsScore.opponent;
    
    // Проверяем, закончилась ли игра (лучший из 5)
    if (rpsScore.player === 3 || rpsScore.opponent === 3) {
        setTimeout(() => {
            const winner = rpsScore.player === 3 ? currentUser.id : 'opponent';
            showGameResult({
                winner: winner,
                score: rpsScore,
                reason: 'best_of_5'
            });
        }, 2000);
    } else {
        // Следующий раунд через 3 секунды
        setTimeout(() => {
            nextRPSRound();
        }, 3000);
    }
}

function determineRPSWinner(playerChoice, opponentChoice) {
    if (playerChoice === opponentChoice) {
        return 'draw';
    }
    
    const winConditions = {
        'rock': 'scissors',
        'paper': 'rock',
        'scissors': 'paper'
    };
    
    return winConditions[playerChoice] === opponentChoice ? 'win' : 'lose';
}

function nextRPSRound() {
    rpsRound++;
    rpsChoice = null;
    opponentChoice = null;
    
    document.getElementById('round-number').textContent = rpsRound;
    document.getElementById('opponent-choice-display').textContent = '❓';
    document.getElementById('rps-status').textContent = 'Выберите ваш ход';
    document.getElementById('rps-status').style.color = 'var(--tg-text)';
    
    document.querySelectorAll('.rps-choice').forEach(choice => {
        choice.classList.remove('selected');
    });
    
    startRPSTimer();
}

function startRPSTimer() {
    const timerBar = document.getElementById('timer-bar');
    if (!timerBar) return;
    
    let timeLeft = 10; // 10 секунд на выбор
    timerBar.style.width = '100%';
    
    const timerInterval = setInterval(() => {
        timeLeft--;
        const percentage = (timeLeft / 10) * 100;
        timerBar.style.width = percentage + '%';
        
        if (percentage < 30) {
            timerBar.style.background = 'var(--danger)';
        } else if (percentage < 60) {
            timerBar.style.background = 'var(--warning)';
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            
            // Если игрок не сделал выбор - случайный выбор
            if (!rpsChoice) {
                const choices = ['rock', 'paper', 'scissors'];
                const randomChoice = choices[Math.floor(Math.random() * choices.length)];
                selectRPS(randomChoice);
            }
        }
    }, 1000);
}

// Дополнительные стили для КНБ (добавить в style.css)
const rpsStyles = `
.rps-score {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    margin-bottom: 16px;
    font-size: 24px;
    font-weight: 700;
}

.score-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
}

.score-label {
    font-size: 12px;
    font-weight: 400;
    color: var(--tg-hint);
}

.score-value {
    font-size: 32px;
}

.score-divider {
    font-size: 32px;
    color: var(--tg-hint);
}

.rps-round {
    text-align: center;
    font-size: 14px;
    color: var(--tg-hint);
    margin-bottom: 24px;
}

.rps-timer {
    margin-top: 24px;
    height: 4px;
    background: var(--tg-secondary-bg);
    border-radius: 2px;
    overflow: hidden;
}

.timer-bar {
    height: 100%;
    background: var(--success);
    transition: width 1s linear, background 0.3s ease;
}
`;

// Добавляем стили в head (если их еще нет)
if (!document.getElementById('rps-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'rps-styles';
    styleElement.textContent = rpsStyles;
    document.head.appendChild(styleElement);
}