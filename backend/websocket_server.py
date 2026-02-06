from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Dict, List
import json
import asyncio
import random
import string
from datetime import datetime

app = FastAPI()

# Подключаем статические файлы
app.mount("/webapp", StaticFiles(directory="webapp"), name="webapp")

# Активные WebSocket соединения
active_connections: Dict[int, WebSocket] = {}

# Активные игры
active_games: Dict[str, dict] = {}

# Очередь поиска игр
game_queue: Dict[str, List[dict]] = {
    'chess': [],
    'checkers': [],
    'rps': []
}

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
    
    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)
    
    async def broadcast_to_game(self, game_id: str, message: dict, exclude_user: int = None):
        if game_id in active_games:
            game = active_games[game_id]
            for player_id in [game['player1']['id'], game['player2']['id']]:
                if player_id != exclude_user and player_id in self.active_connections:
                    await self.active_connections[player_id].send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await handle_websocket_message(user_id, data)
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        await handle_user_disconnect(user_id)

async def handle_websocket_message(user_id: int, data: dict):
    message_type = data.get('type')
    
    if message_type == 'game_action':
        await handle_game_action(user_id, data)
    elif message_type == 'chat_message':
        await handle_chat_message(user_id, data)

async def handle_game_action(user_id: int, data: dict):
    game_id = data.get('gameId')
    action = data.get('action')
    action_data = data.get('data', {})
    
    if game_id not in active_games:
        return
    
    game = active_games[game_id]
    
    if action == 'move':
        # Обрабатываем ход
        game['state'] = action_data
        game['currentPlayer'] = get_opponent_id(game, user_id)
        
        # Отправляем ход сопернику
        opponent_id = get_opponent_id(game, user_id)
        await manager.send_personal_message({
            'type': 'opponent_move',
            'move': action_data
        }, opponent_id)
        
    elif action == 'rps_choice':
        # Обработка КНБ
        round_num = action_data.get('round')
        choice = action_data.get('choice')
        
        if 'rps_choices' not in game:
            game['rps_choices'] = {}
        
        game['rps_choices'][user_id] = choice
        
        # Проверяем, сделали ли оба игрока выбор
        if len(game['rps_choices']) == 2:
            opponent_id = get_opponent_id(game, user_id)
            
            # Отправляем выборы обоим игрокам
            await manager.send_personal_message({
                'type': 'opponent_move',
                'choice': game['rps_choices'][opponent_id]
            }, user_id)
            
            await manager.send_personal_message({
                'type': 'opponent_move',
                'choice': game['rps_choices'][user_id]
            }, opponent_id)
            
            game['rps_choices'] = {}
    
    elif action == 'offer_draw':
        opponent_id = get_opponent_id(game, user_id)
        await manager.send_personal_message({
            'type': 'draw_offer'
        }, opponent_id)
    
    elif action == 'resign':
        opponent_id = get_opponent_id(game, user_id)
        await end_game(game_id, opponent_id, 'resignation')
    
    elif action == 'leave':
        opponent_id = get_opponent_id(game, user_id)
        await manager.send_personal_message({
            'type': 'opponent_left'
        }, opponent_id)
        await end_game(game_id, opponent_id, 'opponent_left')

async def handle_chat_message(user_id: int, data: dict):
    game_id = data.get('gameId')
    text = data.get('text')
    
    if game_id in active_games:
        game = active_games[game_id]
        sender_name = get_player_name(game, user_id)
        
        await manager.broadcast_to_game(game_id, {
            'type': 'chat_message',
            'sender': sender_name,
            'text': text
        })

async def handle_user_disconnect(user_id: int):
    # Найти все игры пользователя и уведомить соперников
    for game_id, game in list(active_games.items()):
        if user_id in [game['player1']['id'], game['player2']['id']]:
            opponent_id = get_opponent_id(game, user_id)
            await manager.send_personal_message({
                'type': 'opponent_left'
            }, opponent_id)
            del active_games[game_id]

def get_opponent_id(game: dict, user_id: int) -> int:
    if game['player1']['id'] == user_id:
        return game['player2']['id']
    return game['player1']['id']

def get_player_name(game: dict, user_id: int) -> str:
    if game['player1']['id'] == user_id:
        return game['player1']['username']
    return game['player2']['username']

async def end_game(game_id: str, winner_id: int, reason: str):
    if game_id in active_games:
        game = active_games[game_id]
        
        # Отправляем результат обоим игрокам
        await manager.broadcast_to_game(game_id, {
            'type': 'game_ended',
            'result': {
                'winner': winner_id,
                'reason': reason,
                'ratingChange': 25,
                'duration': 300  # TODO: посчитать реальное время
            }
        })
        
        del active_games[game_id]

# API endpoints
@app.post("/api/games/create")
async def create_game(data: dict):
    user_id = data['userId']
    game_type = data['gameType']
    
    # Генерируем уникальный код игры
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    game_id = f"{game_type}_{code}_{user_id}"
    
    active_games[game_id] = {
        'id': game_id,
        'code': code,
        'type': game_type,
        'player1': {'id': user_id, 'username': f'Player{user_id}'},
        'player2': None,
        'status': 'waiting',
        'created_at': datetime.now().isoformat()
    }
    
    return {
        'gameId': game_id,
        'code': code
    }

@app.post("/api/games/find")
async def find_game(data: dict):
    user_id = data['userId']
    game_type = data['gameType']
    
    # Добавляем в очередь
    game_queue[game_type].append({
        'userId': user_id,
        'timestamp': datetime.now()
    })
    
    # Проверяем, есть ли еще кто-то в очереди
    if len(game_queue[game_type]) >= 2:
        player1 = game_queue[game_type].pop(0)
        player2 = game_queue[game_type].pop(0)
        
        game_id = f"{game_type}_{random.randint(1000, 9999)}"
        
        game = {
            'id': game_id,
            'type': game_type,
            'player1': {'id': player1['userId'], 'username': f'Player{player1["userId"]}'},
            'player2': {'id': player2['userId'], 'username': f'Player{player2["userId"]}'},
            'status': 'active',
            'currentPlayer': player1['userId'],
            'created_at': datetime.now().isoformat()
        }
        
        active_games[game_id] = game
        
        # Уведомляем обоих игроков
        await manager.send_personal_message({
            'type': 'game_started',
            'game': game
        }, player1['userId'])
        
        await manager.send_personal_message({
            'type': 'game_started',
            'game': game
        }, player2['userId'])
        
        return {'gameId': game_id}
    
    return {'status': 'queued'}

@app.post("/api/games/join")
async def join_game(data: dict):
    user_id = data['userId']
    code = data['code']
    
    # Ищем игру по коду
    game = None
    game_id = None
    
    for gid, g in active_games.items():
        if g.get('code') == code and g['status'] == 'waiting':
            game = g
            game_id = gid
            break
    
    if not game:
        return {'error': 'Game not found'}, 404
    
    # Добавляем второго игрока
    game['player2'] = {'id': user_id, 'username': f'Player{user_id}'}
    game['status'] = 'active'
    game['currentPlayer'] = game['player1']['id']
    
    # Уведомляем обоих игроков
    await manager.send_personal_message({
        'type': 'game_started',
        'game': game
    }, game['player1']['id'])
    
    return {
        'gameId': game_id,
        'game': game
    }

@app.post("/api/games/{game_id}/cancel")
async def cancel_game(game_id: str, data: dict):
    if game_id in active_games:
        del active_games[game_id]
    return {'status': 'cancelled'}

@app.get("/api/games/{game_id}")
async def get_game(game_id: str):
    if game_id in active_games:
        return active_games[game_id]
    return {'error': 'Game not found'}, 404

@app.get("/api/users/{user_id}")
async def get_user(user_id: int):
    # TODO: получить из базы данных
    return {
        'id': user_id,
        'username': f'Player{user_id}',
        'wins': 0,
        'rating': 1000
    }

@app.get("/api/users/{user_id}/games")
async def get_user_games(user_id: int):
    user_games = []
    for game_id, game in active_games.items():
        if user_id in [game['player1']['id'], game.get('player2', {}).get('id')]:
            opponent = game['player2'] if game['player1']['id'] == user_id else game['player1']
            user_games.append({
                'id': game_id,
                'type': game['type'],
                'opponentName': opponent.get('username', 'Waiting...'),
                'status': 'Ваш ход' if game.get('currentPlayer') == user_id else 'Ход соперника'
            })
    return user_games

@app.get("/")
async def root():
    return FileResponse("webapp/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)