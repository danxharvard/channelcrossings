"""One-off Telegram sign-in for the live sightings check in scripts/news.py.

Run it once, somewhere private (a GitHub Codespace on this repo works):
    pip install telethon==1.45.0
    python scripts/tg_login.py
It asks for your API ID and API hash (from https://my.telegram.org > API development tools),
then your phone number and the code Telegram sends you. It prints a long "session" line.

Put three GitHub secrets on the repo (Settings > Secrets and variables > Actions):
    TG_API_ID    the API ID
    TG_API_HASH  the API hash
    TG_SESSION   the session line
Never paste the session line anywhere else: it lets whoever has it use your Telegram account.
To stop it at any time: Telegram > Settings > Devices, and end the session.
"""
from telethon.sessions import StringSession
from telethon.sync import TelegramClient

api_id = int(input("API ID: ").strip())
api_hash = input("API hash: ").strip()
with TelegramClient(StringSession(), api_id, api_hash) as client:   # asks for your phone number and the code
    print("\nSigned in. Your TG_SESSION secret is the line below (copy all of it):\n")
    print(client.session.save())
