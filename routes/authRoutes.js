const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// Destructure controllers
const {
  login,
  register,
  updateProfilePicture,
  changePassword,
  updateEmail,
  forgotPassword,
  getUserRole,
  updateUserRole,
  loginWithGoogle,
  loginWithFacebook,
  loginWithApple,
} = authController;

// ================= Public routes =================
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);

// OAuth / Social logins
router.post("/login/google", loginWithGoogle);
router.post("/login/facebook", loginWithFacebook);
router.post("/login/apple", loginWithApple);

// ================= Protected routes =================
router.put(
  "/profile-picture",
  authMiddleware(),
  upload.single("profilePicture"),
  updateProfilePicture
);
router.put("/change-password", authMiddleware(), changePassword);
router.put("/update-email", authMiddleware(), updateEmail);

// ================= Role routes using token =================
// Get current user's role
router.get("/me/role", authMiddleware(), getUserRole);

// Update current user's role
router.put("/me/role", authMiddleware(), updateUserRole);

module.exports = router;
