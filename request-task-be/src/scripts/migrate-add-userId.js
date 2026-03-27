/**
 * Migration Script: Add userId to existing data
 * 
 * Creates a default admin account and assigns all existing
 * Request/Job/Account documents to that admin.
 * 
 * Run: node src/scripts/migrate-add-userId.js
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI;

// Admin credentials
const ADMIN_EMAIL = "admin@crawlertool.com";
const ADMIN_PASSWORD = "admin123456";
const ADMIN_NAME = "Admin";

async function run() {
  console.log("🔗 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected!\n");

  // ===== 1. Create or find admin user =====
  const UserCol = mongoose.connection.collection("users");

  let admin = await UserCol.findOne({ email: ADMIN_EMAIL });
  
  if (!admin) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

    const result = await UserCol.insertOne({
      email: ADMIN_EMAIL,
      password: hashedPassword,
      name: ADMIN_NAME,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    admin = { _id: result.insertedId };
    console.log(`✅ Created admin account: ${ADMIN_EMAIL} (password: ${ADMIN_PASSWORD})`);
  } else {
    // Ensure role is admin
    await UserCol.updateOne({ _id: admin._id }, { $set: { role: "admin" } });
    console.log(`✅ Admin account already exists: ${ADMIN_EMAIL}`);
  }

  const adminId = admin._id;
  console.log(`   Admin ID: ${adminId}\n`);

  // ===== 2. Assign userId to all existing documents =====
  const collections = [
    "tiktokrequests",
    "twitterrequests",
    "youtuberequests",
    "instagramrequests",
    "pinterestrequests",
    "googlemapjobs",
    "chplaytasks",
    "appstoretasks",
    "socialaccounts",
  ];

  for (const colName of collections) {
    try {
      const col = mongoose.connection.collection(colName);
      const result = await col.updateMany(
        { userId: { $exists: false } },
        { $set: { userId: adminId } }
      );
      console.log(`📝 ${colName}: updated ${result.modifiedCount} documents`);
    } catch (err) {
      console.log(`⚠️  ${colName}: ${err.message} (may not exist yet)`);
    }
  }

  console.log("\n🎉 Migration complete!");
  console.log(`\n📌 Admin login:\n   Email: ${ADMIN_EMAIL}\n   Password: ${ADMIN_PASSWORD}`);
  
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
