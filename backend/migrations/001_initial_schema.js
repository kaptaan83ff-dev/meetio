module.exports = {
  async up(db, client) {
    const collections = [
      "users",
      "sessions",
      "meetings",
      "participants",
      "guest_sessions",
      "recaps",
      "transcripts",
      "action_items",
      "conversations",
      "messages",
      "messenger_keys",
      "calendar_events",
      "gcal_tokens",
      "chat_messages",
      "notifications",
      "dead_letter_events"
    ];

    for (const collection of collections) {
      // Create collection if it doesn't exist
      const existingCollections = await db.listCollections({ name: collection }).toArray();
      if (existingCollections.length === 0) {
        await db.createCollection(collection);
      }
    }
  },

  async down(db, client) {
    const collections = [
      "users",
      "sessions",
      "meetings",
      "participants",
      "guest_sessions",
      "recaps",
      "transcripts",
      "action_items",
      "conversations",
      "messages",
      "messenger_keys",
      "calendar_events",
      "gcal_tokens",
      "chat_messages",
      "notifications",
      "dead_letter_events"
    ];

    for (const collection of collections) {
      await db.collection(collection).drop().catch(() => {});
    }
  }
};
