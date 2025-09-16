const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // hashed
    role: {
      type: String,
      enum: ["admin", "reader", "writer"],
      default: "admin",
    },

    // Profile Picture (URLF or path to uploaded file)
    profilePicture: {
      type: String,
      default: "https://via.placeholder.com/150", // fallback avatar
    },

    // Liked articles
    likedArticles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Article",
      },
    ],

    // Saved articles
    savedArticles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Article",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
