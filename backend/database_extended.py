import aiosqlite
from datetime import datetime

class Database:
    def __init__(self, db_path="backend/databases/database.db"):
        self.db_path = db_path
    
    async def init_db(self):
        async with aiosqlite.connect(self.db_path) as db:
            # Таблица пользователей
            await db.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER PRIMARY KEY,
                    language TEXT,
                    username TEXT,
                    rating INTEGER DEFAULT 1000,
                    wins INTEGER DEFAULT 0,
                    losses INTEGER DEFAULT 0,
                    draws INTEGER DEFAULT 0,
                    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Таблица игр
            await db.execute("""
                CREATE TABLE IF NOT EXISTS games (
                    game_id TEXT PRIMARY KEY,
                    game_type TEXT,
                    player1_id INTEGER,
                    player2_id INTEGER,
                    winner_id INTEGER,
                    status TEXT,
                    moves_count INTEGER DEFAULT 0,
                    duration INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    finished_at TIMESTAMP,
                    FOREIGN KEY (player1_id) REFERENCES users (user_id),
                    FOREIGN KEY (player2_id) REFERENCES users (user_id)
                )
            """)
            
            # Таблица статистики по играм
            await db.execute("""
                CREATE TABLE IF NOT EXISTS game_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    game_type TEXT,
                    wins INTEGER DEFAULT 0,
                    losses INTEGER DEFAULT 0,
                    draws INTEGER DEFAULT 0,
                    FOREIGN KEY (user_id) REFERENCES users (user_id),
                    UNIQUE(user_id, game_type)
                )
            """)
            
            await db.commit()
    
    async def add_user(self, user_id, language, username=None):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT OR REPLACE INTO users (user_id, language, username) VALUES (?, ?, ?)", 
                (user_id, language, username or f"Player{user_id}")
            )
            await db.commit()
    
    async def get_user(self, user_id):
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)) as cursor:
                return await cursor.fetchone()
    
    async def get_user_stats(self, user_id):
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("""
                SELECT 
                    rating,
                    wins,
                    losses,
                    draws,
                    (wins + losses + draws) as total_games
                FROM users 
                WHERE user_id = ?
            """, (user_id,)) as cursor:
                row = await cursor.fetchone()
                if row:
                    return {
                        'rating': row[0],
                        'wins': row[1],
                        'losses': row[2],
                        'draws': row[3],
                        'total_games': row[4]
                    }
                return None
    
    async def update_stats(self, user_id, result):
        """
        Обновление статистики после игры
        result = {'outcome': 'win'|'loss'|'draw', 'rating_change': int}
        """
        async with aiosqlite.connect(self.db_path) as db:
            outcome = result.get('outcome')
            rating_change = result.get('rating_change', 0)
            
            if outcome == 'win':
                await db.execute("""
                    UPDATE users 
                    SET wins = wins + 1, rating = rating + ?
                    WHERE user_id = ?
                """, (rating_change, user_id))
            elif outcome == 'loss':
                await db.execute("""
                    UPDATE users 
                    SET losses = losses + 1, rating = rating + ?
                    WHERE user_id = ?
                """, (rating_change, user_id))
            elif outcome == 'draw':
                await db.execute("""
                    UPDATE users 
                    SET draws = draws + 1
                    WHERE user_id = ?
                """, (user_id,))
            
            await db.commit()
    
    async def get_leaderboard(self, limit=10):
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("""
                SELECT user_id, username, rating, wins, losses, draws
                FROM users
                ORDER BY rating DESC
                LIMIT ?
            """, (limit,)) as cursor:
                rows = await cursor.fetchall()
                return [
                    {
                        'user_id': row[0],
                        'username': row[1],
                        'rating': row[2],
                        'wins': row[3],
                        'losses': row[4],
                        'draws': row[5]
                    }
                    for row in rows
                ]
    
    async def save_game(self, game_data):
        """Сохранение завершенной игры"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO games (
                    game_id, game_type, player1_id, player2_id, 
                    winner_id, status, moves_count, duration, finished_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                game_data['game_id'],
                game_data['game_type'],
                game_data['player1_id'],
                game_data['player2_id'],
                game_data.get('winner_id'),
                game_data['status'],
                game_data.get('moves_count', 0),
                game_data.get('duration', 0),
                datetime.now()
            ))
            await db.commit()
    
    async def get_user_game_history(self, user_id, limit=20):
        """Получить историю игр пользователя"""
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("""
                SELECT 
                    g.game_id,
                    g.game_type,
                    g.winner_id,
                    g.finished_at,
                    u.username as opponent_name
                FROM games g
                LEFT JOIN users u ON (
                    CASE 
                        WHEN g.player1_id = ? THEN g.player2_id
                        ELSE g.player1_id
                    END = u.user_id
                )
                WHERE g.player1_id = ? OR g.player2_id = ?
                ORDER BY g.finished_at DESC
                LIMIT ?
            """, (user_id, user_id, user_id, limit)) as cursor:
                rows = await cursor.fetchall()
                return [
                    {
                        'game_id': row[0],
                        'game_type': row[1],
                        'result': 'win' if row[2] == user_id else 'loss' if row[2] else 'draw',
                        'finished_at': row[3],
                        'opponent_name': row[4]
                    }
                    for row in rows
                ]
    
    async def update_game_stats(self, user_id, game_type, result):
        """Обновление статистики по конкретной игре"""
        async with aiosqlite.connect(self.db_path) as db:
            # Создаем запись если её нет
            await db.execute("""
                INSERT OR IGNORE INTO game_stats (user_id, game_type)
                VALUES (?, ?)
            """, (user_id, game_type))
            
            if result == 'win':
                column = 'wins'
            elif result == 'loss':
                column = 'losses'
            else:
                column = 'draws'
            
            await db.execute(f"""
                UPDATE game_stats 
                SET {column} = {column} + 1
                WHERE user_id = ? AND game_type = ?
            """, (user_id, game_type))
            
            await db.commit()