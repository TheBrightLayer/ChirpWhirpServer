const Category = require("../models/Category");
const Blog = require("../models/Blog");

exports.createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    const category = new Category({ name, description, image });
    await category.save();

    res.json({ msg: "✅ Category created", category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// ✅ Get all blogs in a category
exports.getBlogsByCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const blogs = await Blog.find({ category: id })
      .populate("author", "name email") // only return name + email of author
      .populate("category", "name"); // return category name

    res.json(blogs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Get blogs by category name
exports.getBlogsByCategoryName = async (req, res) => {
  try {
    const { name } = req.params;

    // case-insensitive match
    const blogs = await Blog.find({ category: new RegExp(`^${name}$`, "i") });

    if (!blogs || blogs.length === 0) {
      return res.status(404).json({ msg: "No blogs found for this category" });
    }

    res.json(blogs);
  } catch (err) {
    console.error("Error fetching blogs by category:", err);
    res.status(500).json({ msg: "Server error" });
  }
};
