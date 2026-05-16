module.exports = {
  async up(db, client) {
    // 1. users
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("users").createIndex(
      { google_id: 1 },
      { unique: true, partialFilterExpression: { google_id: { $type: "string" } } }
    );
    await db.collection("users").createIndex({ is_active: 1, deletion_scheduled_at: 1 });

    // 2. sessions
    await db.collection("sessions").createIndex({ user_id: 1, is_revoked: 1 });
    await db.collection("sessions").createIndex(
      { refresh_token_hash: 1 },
      { unique: true, partialFilterExpression: { refresh_token_hash: { $type: "string" } } }
    );
    await db.collection("sessions").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }); // TTL index

    // 3. meetings
    await db.collection("meetings").createIndex({ slug: 1 }, { unique: true });
    await db.collection("meetings").createIndex({ host_user_id: 1, created_at: -1 });
    await db.collection("meetings").createIndex({ status: 1, scheduled_at: 1 });
    await db.collection("meetings").createIndex({ ended_at: 1 });
    await db.collection("meetings").createIndex({ recap_status: 1 });

    // 4. participants
    await db.collection("participants").createIndex({ meeting_id: 1 });
    await db.collection("participants").createIndex({ meeting_id: 1, user_id: 1 });
    await db.collection("participants").createIndex({ session_id: 1 });
    await db.collection("participants").createIndex({ user_id: 1, joined_at: -1 });

    // 5. guest_sessions
    await db.collection("guest_sessions").createIndex({ session_id: 1 }, { unique: true });
    await db.collection("guest_sessions").createIndex({ meeting_id: 1 });
    await db.collection("guest_sessions").createIndex({ purge_at: 1 }, { expireAfterSeconds: 0 }); // TTL index

    // 6. recaps
    await db.collection("recaps").createIndex({ meeting_id: 1 }, { unique: true });
    await db.collection("recaps").createIndex({ status: 1, updated_at: -1 });

    // 7. transcripts
    await db.collection("transcripts").createIndex({ meeting_id: 1 }, { unique: true });

    // 8. action_items
    await db.collection("action_items").createIndex({ meeting_id: 1 });
    await db.collection("action_items").createIndex({ assigned_to: 1, status: 1 });
    await db.collection("action_items").createIndex({ assigned_to: 1, due_date: 1 });
    await db.collection("action_items").createIndex({ status: 1, due_date: 1 });

    // 9. conversations
    await db.collection("conversations").createIndex({ member_ids: 1 });
    await db.collection("conversations").createIndex({ member_ids: 1, last_message_at: -1 });

    // 10. messages
    await db.collection("messages").createIndex({ conversation_id: 1, created_at: -1 });
    await db.collection("messages").createIndex({ sender_id: 1 });

    // 11. messenger_keys
    await db.collection("messenger_keys").createIndex({ user_id: 1 }, { unique: true });

    // 12. calendar_events
    await db.collection("calendar_events").createIndex({ user_id: 1, start_at: 1 });
    await db.collection("calendar_events").createIndex({ user_id: 1, end_at: 1 });
    await db.collection("calendar_events").createIndex({ gcal_event_id: 1 }, { sparse: true });
    await db.collection("calendar_events").createIndex({ meeting_id: 1 }, { sparse: true });

    // 13. gcal_tokens
    await db.collection("gcal_tokens").createIndex({ user_id: 1 }, { unique: true });
    await db.collection("gcal_tokens").createIndex({ channel_expiry: 1 });
    await db.collection("gcal_tokens").createIndex({ channel_id: 1 });

    // 14. chat_messages
    await db.collection("chat_messages").createIndex({ meeting_id: 1, created_at: 1 });
    await db.collection("chat_messages").createIndex({ purge_at: 1 }, { expireAfterSeconds: 0 }); // TTL index

    // 15. notifications
    await db.collection("notifications").createIndex({ user_id: 1, read: 1, created_at: -1 });
    await db.collection("notifications").createIndex({ user_id: 1, created_at: -1 });
    await db.collection("notifications").createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL

    // 16. dead_letter_events
    await db.collection("dead_letter_events").createIndex({ resolved: 1, next_retry_at: 1 });
    await db.collection("dead_letter_events").createIndex({ created_at: 1 }, { expireAfterSeconds: 604800 }); // 7 days TTL for resolved (set in code, but index helps)
  },

  async down(db, client) {
    const collections = [
      "users", "sessions", "meetings", "participants", "guest_sessions",
      "recaps", "transcripts", "action_items", "conversations", "messages",
      "messenger_keys", "calendar_events", "gcal_tokens", "chat_messages",
      "notifications", "dead_letter_events"
    ];

    for (const collection of collections) {
      await db.collection(collection).dropIndexes();
    }
  }
};
