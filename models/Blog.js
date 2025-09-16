const mongoose = require("mongoose");
const slugify = require("slugify");

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    mainImage: { type: String },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    authorProfileImage: { type: String },
    category: { type: String, required: true },
    slug: { type: String, unique: true }, // 👈 SEO slug

    // 👇 SEO fields
    metaTitle: { type: String },
    metaDesc: { type: String },
  },
  { timestamps: true }
);

// ✅ Auto-generate unique slug
blogSchema.pre("save", async function (next) {
  if (this.isModified("title")) {
    let baseSlug = slugify(this.title, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    while (await mongoose.models.Blog.findOne({ slug })) {
      slug = `${baseSlug}-${counter++}`;
    }

    this.slug = slug;
  }

  // ✅ Auto-generate metaTitle if missing
  if (!this.metaTitle || this.metaTitle.trim() === "") {
    this.metaTitle = this.title;
  }

  // ✅ Auto-generate metaDesc if missing
  if (!this.metaDesc || this.metaDesc.trim() === "") {
    this.metaDesc = this.content
      .replace(/<[^>]+>/g, "") // remove any HTML tags
      .replace(/\s+/g, " ") // normalize spaces
      .trim()
      .slice(0, 160); // best SEO length
  }

  next();
});

module.exports = mongoose.model("Blog", blogSchema);
