// seedAdmin.js
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("./models/User");

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = new User({
    username: "Admin",
    email: "admin@example.com",
    password: hashedPassword,
    role: "admin"
  });

  await admin.save();
  console.log("✅ Admin user created");
  mongoose.connection.close();
});
