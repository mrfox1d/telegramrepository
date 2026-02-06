from aiogram import Router, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
import json

router = Router()
db = None

@router.message(Command(commands=['start']))
async def cmd_start(message: types.Message):
    user = await db.get_user(message.from_user.id)
    
    if not user:
        # Выбор языка для новых пользователей
        mk = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🇷🇺 Русский",
                    callback_data="ru"
                ),
                InlineKeyboardButton(
                    text="🇺🇸 English",
                    callback_data="en"
                )
            ]
        ])
        await message.answer("🇷🇺 Выберите язык:\n🇺🇸 Choose language:", reply_markup=mk)
    else:
        # Кнопка для открытия Mini App
        webapp_url = "https://your-domain.com/webapp"  # Замените на ваш URL
        
        webapp_keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🎮 Играть",
                    web_app=WebAppInfo(url=webapp_url)
                )
            ],
            [
                InlineKeyboardButton(
                    text="📊 Статистика",
                    callback_data="stats"
                ),
                InlineKeyboardButton(
                    text="🏆 Рейтинг",
                    callback_data="leaderboard"
                )
            ]
        ])
        
        if user[1] == "ru":
            await message.answer(
                f"🎲 С возвращением, {message.from_user.first_name}!\n\n"
                f"Выберите действие:",
                reply_markup=webapp_keyboard
            )
        elif user[1] == "en":
            await message.answer(
                f"🎲 Welcome back, {message.from_user.first_name}!\n\n"
                f"Choose an action:",
                reply_markup=webapp_keyboard
            )

@router.callback_query(lambda c: c.data in ["ru", "en"])
async def set_language(callback: types.CallbackQuery):
    await db.add_user(callback.from_user.id, callback.data)
    
    # Кнопка для открытия Mini App
    webapp_url = "https://your-domain.com/webapp"  # Замените на ваш URL
    
    webapp_keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text="🎮 Играть" if callback.data == "ru" else "🎮 Play",
                web_app=WebAppInfo(url=webapp_url)
            )
        ]
    ])
    
    if callback.message:
        if callback.data == "ru":
            await callback.message.answer(
                "✅ Язык установлен на русский\n\n"
                "Нажмите кнопку ниже, чтобы начать играть!",
                reply_markup=webapp_keyboard
            )
        elif callback.data == "en":
            await callback.message.answer(
                "✅ Language set to English\n\n"
                "Press the button below to start playing!",
                reply_markup=webapp_keyboard
            )
    
    await callback.answer()

@router.callback_query(lambda c: c.data == "stats")
async def show_stats(callback: types.CallbackQuery):
    stats = await db.get_user_stats(callback.from_user.id)
    
    if stats:
        await callback.message.answer(
            f"📊 Ваша статистика:\n\n"
            f"🏆 Побед: {stats['wins']}\n"
            f"😔 Поражений: {stats['losses']}\n"
            f"🤝 Ничьих: {stats['draws']}\n"
            f"⭐ Рейтинг: {stats['rating']}\n"
            f"🎮 Всего игр: {stats['total_games']}"
        )
    else:
        await callback.message.answer("Статистика пока пуста. Сыграйте первую игру!")
    
    await callback.answer()

@router.callback_query(lambda c: c.data == "leaderboard")
async def show_leaderboard(callback: types.CallbackQuery):
    top_players = await db.get_leaderboard(limit=10)
    
    if top_players:
        text = "🏆 Топ-10 игроков:\n\n"
        for i, player in enumerate(top_players, 1):
            emoji = "🥇" if i == 1 else "🥈" if i == 2 else "🥉" if i == 3 else f"{i}."
            text += f"{emoji} {player['username']} - {player['rating']} ⭐\n"
        
        await callback.message.answer(text)
    else:
        await callback.message.answer("Рейтинг пока пуст!")
    
    await callback.answer()

# Обработка данных от WebApp
@router.message(F.web_app_data)
async def handle_webapp_data(message: types.Message):
    try:
        data = json.loads(message.web_app_data.data)
        action = data.get('action')
        
        if action == 'game_completed':
            # Обновляем статистику после игры
            result = data.get('result')
            await db.update_stats(message.from_user.id, result)
            
            await message.answer(
                f"✅ Игра завершена!\n"
                f"Результат: {result.get('outcome')}\n"
                f"Рейтинг: {result.get('rating_change', 0):+d}"
            )
        
        elif action == 'share_game':
            game_code = data.get('code')
            await message.answer(
                f"🎮 Приглашение в игру!\n"
                f"Код: {game_code}\n\n"
                f"Друг может присоединиться, введя этот код в приложении."
            )
    
    except Exception as e:
        print(f"Error handling webapp data: {e}")
        await message.answer("Произошла ошибка при обработке данных.")