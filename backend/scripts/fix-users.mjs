import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = "mongodb://127.0.0.1:27017/yt-database";

async function fixUsers() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to local MongoDB");

  const col = mongoose.connection.db.collection("users");
  const users = await col.find({}).toArray();

  console.log(`\nFound ${users.length} user(s):\n`);

  for (const user of users) {
    const isBcrypt = user.password?.startsWith("$2b$") || user.password?.startsWith("$2a$");
    console.log(`  username: ${user.username}`);
    console.log(`  email:    ${user.email}`);
    console.log(`  pwd[:10]: ${user.password?.substring(0, 10)}`);
    console.log(`  isBcrypt: ${isBcrypt}`);
    console.log("---");
  }

  // Delete all non-bcrypt users (corrupted plain-text passwords)
  const badUsers = users.filter(u => !(u.password?.startsWith("$2b$") || u.password?.startsWith("$2a$")));
  if (badUsers.length > 0) {
    const badIds = badUsers.map(u => u._id);
    const result = await col.deleteMany({ _id: { $in: badIds } });
    console.log(`\n✓ Deleted ${result.deletedCount} corrupted user(s) with plain-text passwords:`);
    badUsers.forEach(u => console.log(`  - ${u.username} (${u.email})`));
    console.log("\nPlease re-register these users at http://localhost:5173/register");
  } else {
    console.log("\n✓ All users have properly bcrypt-hashed passwords. No cleanup needed.");
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

fixUsers().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
