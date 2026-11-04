import mongoose from "mongoose";

async function updateMetadata() {
  const c = await mongoose.connect("mongodb://127.0.0.1:27017/yt-database");
  const col = c.connection.db.collection("videos");

  await col.updateOne(
    { title: /Tushar/i },
    { $set: { category: "Comedy", tags: ["comedy", "standup", "humor", "funny"] } }
  );
  await col.updateOne(
    { title: /Rajpal/i },
    { $set: { category: "Comedy", tags: ["comedy", "funny", "humor", "bollywood"] } }
  );
  await col.updateOne(
    { title: /Machine Learning/i },
    { $set: { category: "Technology", tags: ["technology", "ml", "ai", "programming"] } }
  );
  await col.updateOne(
    { title: /Javascript/i },
    { $set: { category: "Technology", tags: ["technology", "javascript", "programming", "webdev"] } }
  );
  await col.updateOne(
    { title: /MSDHONI/i },
    { $set: { category: "Sports", tags: ["sports", "cricket", "dhoni", "india"] } }
  );

  console.log("Categories and tags updated successfully!");
  await mongoose.disconnect();
}

updateMetadata().catch(console.error);
