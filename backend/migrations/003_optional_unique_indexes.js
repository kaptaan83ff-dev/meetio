async function ensureOptionalUniqueIndex(db, collectionName, fieldName) {
  const collection = db.collection(collectionName);
  const indexName = `${fieldName}_1`;
  const indexes = await collection.indexes();
  const existing = indexes.find((index) => index.name === indexName);
  const partialFilterExpression = { [fieldName]: { $type: "string" } };

  if (
    existing &&
    (
      existing.unique !== true ||
      JSON.stringify(existing.partialFilterExpression) !== JSON.stringify(partialFilterExpression)
    )
  ) {
    await collection.dropIndex(indexName);
  }

  await collection.createIndex(
    { [fieldName]: 1 },
    { unique: true, partialFilterExpression }
  );
}

module.exports = {
  async up(db, client) {
    await ensureOptionalUniqueIndex(db, "users", "google_id");
    await ensureOptionalUniqueIndex(db, "sessions", "refresh_token_hash");
  },

  async down(db, client) {
    await db.collection("users").dropIndex("google_id_1");
    await db.collection("users").createIndex({ google_id: 1 }, { sparse: true, unique: true });

    await db.collection("sessions").dropIndex("refresh_token_hash_1");
    await db.collection("sessions").createIndex({ refresh_token_hash: 1 }, { unique: true });
  },
};
