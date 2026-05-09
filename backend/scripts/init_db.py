import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

async def init_db():
    print(f"--- Python DB Initializer ---")
    print(f"Connecting to: {settings.MONGODB_URI.split('@')[-1]}")
    print(f"Database: {settings.MONGODB_DB_NAME}")
    
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB_NAME]
    
    collections = [
        "users", "sessions", "meetings", "participants", "guest_sessions",
        "recaps", "transcripts", "action_items", "conversations", "messages",
        "messenger_keys", "calendar_events", "gcal_tokens", "chat_messages",
        "notifications", "dead_letter_events"
    ]

    print("\nCreating collections...")
    existing_collections = await db.list_collection_names()
    for coll in collections:
        if coll not in existing_collections:
            await db.create_collection(coll)
            print(f"  [+] Created {coll}")
        else:
            print(f"  [.] {coll} already exists")

    print("\nCreating indexes...")
    
    # 1. users
    await db.users.create_index("email", unique=True)
    await db.users.create_index("google_id", sparse=True, unique=True)
    await db.users.create_index([("is_active", 1), ("deletion_scheduled_at", 1)])

    # 2. sessions
    await db.sessions.create_index([("user_id", 1), ("is_revoked", 1)])
    await db.sessions.create_index("refresh_token_hash", unique=True)
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)

    # 3. meetings
    await db.meetings.create_index("slug", unique=True)
    await db.meetings.create_index([("host_user_id", 1), ("created_at", -1)])
    await db.meetings.create_index([("status", 1), ("scheduled_at", 1)])
    await db.meetings.create_index("ended_at")
    await db.meetings.create_index("recap_status")

    # 4. participants
    await db.participants.create_index("meeting_id")
    await db.participants.create_index([("meeting_id", 1), ("user_id", 1)])
    await db.participants.create_index("session_id")
    await db.participants.create_index([("user_id", 1), ("joined_at", -1)])

    # 5. guest_sessions
    await db.guest_sessions.create_index("session_id", unique=True)
    await db.guest_sessions.create_index("meeting_id")
    await db.guest_sessions.create_index("purge_at", expireAfterSeconds=0)

    # 6. recaps
    await db.recaps.create_index("meeting_id", unique=True)
    await db.recaps.create_index([("status", 1), ("updated_at", -1)])

    # 7. transcripts
    await db.transcripts.create_index("meeting_id", unique=True)

    # 8. action_items
    await db.action_items.create_index("meeting_id")
    await db.action_items.create_index([("assigned_to", 1), ("status", 1)])
    await db.action_items.create_index([("assigned_to", 1), ("due_date", 1)])
    await db.action_items.create_index([("status", 1), ("due_date", 1)])

    # 9. conversations
    await db.conversations.create_index("member_ids")
    await db.conversations.create_index([("member_ids", 1), ("last_message_at", -1)])

    # 10. messages
    await db.messages.create_index([("conversation_id", 1), ("created_at", -1)])
    await db.messages.create_index("sender_id")

    # 11. messenger_keys
    await db.messenger_keys.create_index("user_id", unique=True)

    # 12. calendar_events
    await db.calendar_events.create_index([("user_id", 1), ("start_at", 1)])
    await db.calendar_events.create_index([("user_id", 1), ("end_at", 1)])
    await db.calendar_events.create_index("gcal_event_id", sparse=True)
    await db.calendar_events.create_index("meeting_id", sparse=True)

    # 13. gcal_tokens
    await db.gcal_tokens.create_index("user_id", unique=True)
    await db.gcal_tokens.create_index("channel_expiry")
    await db.gcal_tokens.create_index("channel_id")

    # 14. chat_messages
    await db.chat_messages.create_index([("meeting_id", 1), ("created_at", 1)])
    await db.chat_messages.create_index("purge_at", expireAfterSeconds=0)

    # 15. notifications
    await db.notifications.create_index([("user_id", 1), ("read", 1), ("created_at", -1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.notifications.create_index("created_at", expireAfterSeconds=7776000)

    # 16. dead_letter_events
    await db.dead_letter_events.create_index([("resolved", 1), ("next_retry_at", 1)])
    await db.dead_letter_events.create_index("created_at", expireAfterSeconds=604800)

    print("\nAll collections and indexes initialized successfully.")
    client.close()

if __name__ == "__main__":
    asyncio.run(init_db())
