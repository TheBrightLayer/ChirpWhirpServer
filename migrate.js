const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Blog = require("./models/Blog"); // adjust path if needed

dotenv.config();

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

(async () => {
  try {
    const blogs = await Blog.find({ mainImage: { $regex: /^uploads[\/\\]/ } });

    console.log(`Found ${blogs.length} blogs with local uploads`);

    for (const blog of blogs) {
      const filePath = path.join(__dirname, blog.mainImage);

      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const mimeType = getMimeType(filePath);

        // Convert to base64
        const base64Image = `data:${mimeType};base64,${fileBuffer.toString(
          "base64"
        )}`;

        // Update blog
        blog.mainImage = base64Image;
        await blog.save();

        console.log(`✅ Updated blog: ${blog._id}`);
      } else {
        console.warn(`⚠️ File not found: ${filePath} for blog ${blog._id}`);
      }
    }

    console.log("🎉 Migration complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  }
})();

// Helper function to guess MIME type
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}
