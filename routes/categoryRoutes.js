const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const authMiddleware = require("../middleware/authMiddleware");
const categoryController = require("../controllers/categoryController");

// Create category (admin only)
router.post(
  "/create",
  authMiddleware(["admin"]),
  upload.single("image"),
  categoryController.createCategory
);

// Get all categories
router.get("/", categoryController.getCategories);

// ✅ Put this first (more specific)
router.get("/category/:name", categoryController.getBlogsByCategoryName);

// ✅ This comes after (generic)
router.get("/:id/blogs", categoryController.getBlogsByCategory);

module.exports = router;
