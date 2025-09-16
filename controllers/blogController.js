// controllers/blogController.js
const Blog = require("../models/Blog");
const translateText = require("../utils/translateText"); // translation utility
const multer = require("multer");

// ---------- Multer setup for handling cover image ----------
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware to handle 'cover' file
exports.uploadCover = upload.single("cover");

// --------------------- GET ALL BLOGS ---------------------
// --------------------- GET ALL BLOGS ---------------------
exports.getAllBlogs = async (req, res) => {
  try {
    const { category, page = 1, limit = 10, lang = "en" } = req.query;

    const query = category ? { category } : {};
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch blogs with category filter and pagination
    let blogs = await Blog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const translatedBlogs = await Promise.all(
      blogs.map(async (blog) => {
        try {
          if (lang === "hi") {
            const translatedTitle = await translateText(blog.title, "en", "hi");
            const translatedContent = await translateText(blog.content, "en", "hi");
            const translatedMetaTitle = blog.metaTitle
              ? await translateText(blog.metaTitle, "en", "hi")
              : "";
            const translatedMetaDesc = blog.metaDesc
              ? await translateText(blog.metaDesc, "en", "hi")
              : "";

            return {
              ...blog._doc,
              title: translatedTitle,
              content: translatedContent,
              metaTitle: translatedMetaTitle,
              metaDesc: translatedMetaDesc,
            };
          }
          return blog;
        } catch (error) {
          console.error("Error translating blog:", error);
          return blog;
        }
      })
    );

    // Total blogs for the given category (useful for pagination in frontend)
    const totalBlogs = await Blog.countDocuments(query);

    res.json({
      blogs: translatedBlogs,
      total: totalBlogs,
      page: parseInt(page),
      totalPages: Math.ceil(totalBlogs / parseInt(limit)),
    });
  } catch (err) {
    console.error("Error fetching blogs:", err);
    res.status(500).json({ msg: "Server error" });
  }
};



// --------------------- GET BLOG BY SLUG ---------------------
exports.getBlogBySlug = async (req, res) => {
  const { lang = "en" } = req.query;

  try {
    const blog = await Blog.findOne({ slug: req.params.slug });
    if (!blog) return res.status(404).json({ msg: "Blog not found" });

    if (lang === "hi") {
      try {
        const translatedTitle = await translateText(blog.title, "en", "hi");
        const translatedContent = await translateText(blog.content, "en", "hi");
        const translatedCategory = await translateText(blog.category, "en", "hi");
        const translatedMetaTitle = blog.metaTitle
          ? await translateText(blog.metaTitle, "en", "hi")
          : "";
        const translatedMetaDesc = blog.metaDesc
          ? await translateText(blog.metaDesc, "en", "hi")
          : "";

        return res.json({
          ...blog.toObject(),
          title: translatedTitle,
          content: translatedContent,
          category: translatedCategory,
          metaTitle: translatedMetaTitle,
          metaDesc: translatedMetaDesc,
        });
      } catch (error) {
        console.error("Error translating blog by slug:", error);
        return res.json(blog);
      }
    }

    res.json(blog);
  } catch (err) {
    console.error("Error fetching blog by slug:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// --------------------- CREATE BLOG ---------------------
exports.createBlog = async (req, res) => {
  try {
    const { title, content, category, tags, metaTitle, metaDesc } = req.body;

    let imageBase64 = null;
    if (req.file && req.file.buffer) {
      imageBase64 = `data:${
        req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;
    }

    const newBlog = new Blog({
      title,
      content,
      category,
      tags: tags ? JSON.parse(tags) : [],
      mainImage: imageBase64,

      // ✅ if these are missing, schema will auto-fill
      metaTitle: metaTitle && metaTitle.trim() !== "" ? metaTitle : undefined,
      metaDesc: metaDesc && metaDesc.trim() !== "" ? metaDesc : undefined,
    });

    await newBlog.save();
    res.status(201).json(newBlog);
  } catch (err) {
    console.error("CreateBlog Error:", err.message, err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// --------------------- UPDATE BLOG ---------------------
exports.updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ msg: "Blog not found" });

    // ✅ Update fields
    Object.assign(blog, req.body);

    // ✅ If metaTitle or metaDesc are empty → regenerate
    if (!blog.metaTitle || blog.metaTitle.trim() === "") {
      blog.metaTitle = blog.title;
    }
    if (!blog.metaDesc || blog.metaDesc.trim() === "") {
      blog.metaDesc = blog.content
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);
    }

    await blog.save();
    res.json(blog);
  } catch (err) {
    console.error("UpdateBlog Error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};



// --------------------- DELETE BLOG ---------------------
// controllers/blogController.js
exports.deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findOneAndDelete({ slug: req.params.slug });

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.json({ message: "Blog deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

