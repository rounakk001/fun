import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function resetPassword() {
  await mongoose.connect("mongodb://127.0.0.1:27017/yt-database");
  
  const col = mongoose.connection.db.collection("users");
  
  // Reset rounak_singh to a known password
  const newPassword = "Password@123";
  const hash = await bcrypt.hash(newPassword, 10);
  
  const result = await col.updateOne(
    { username: "rounak_singh" },
    { $set: { password: hash } }
  );
  
  if (result.modifiedCount === 1) {
    console.log(`\n✓ Password for rounak_singh reset successfully!`);
    console.log(`  New password: ${newPassword}`);
    console.log(`  New hash:     ${hash}`);
    console.log(`\nYou can now log in at http://localhost:5173/login with:`);
    console.log(`  Email:    rounaksingh2303@gmail.com`);
    console.log(`  Password: ${newPassword}`);
  } else {
    console.log("User not found or password not changed.");
  }
  
  await mongoose.disconnect();
}

resetPassword().catch(console.error);
