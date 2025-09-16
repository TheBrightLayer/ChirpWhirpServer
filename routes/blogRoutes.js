// routes/blogRoutes.js
const express = require("express");
const router = express.Router();
const blogController = require("../controllers/blogController");
const authMiddleware = require("../middleware/authMiddleware");

// Use the upload middleware from the controller (memory storage)
router.post(
  "/create",
  blogController.uploadCover, // multer memory storage
  blogController.createBlog
);

// ✅ Public routes
router.get("/", blogController.getAllBlogs);
router.get("/:slug", blogController.getBlogBySlug);

// ✅ Protected routes (only admins can update/delete)
router.put("/:id", authMiddleware(["admin"]), blogController.updateBlog);
router.delete("/:slug", blogController.deleteBlog);

module.exports = router;
