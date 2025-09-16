const express = require("express");
const serverless = require("serverless-http");
const dotenv = require("dotenv");
const connectDB = require("../../config/db");
const categoryRoutes = require("../../routes/categoryRoutes");
const cors = require("cors");

dotenv.config();
connectDB();

const app = express();

// ✅ CORS middleware
app.use(
  cors({
    origin: "*", // replace with frontend domain in production
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", require("../../routes/authRoutes"));
app.use("/api/blogs", require("../../routes/blogRoutes"));
app.use("/api/categories", categoryRoutes);

// ❌ uploads (Netlify functions can’t serve static files directly)
// If needed, move uploads to /public/uploads

// Default route
app.get("/", (req, res) => {
  res.send("🚀 Backend running on Netlify Functions!");
});

// Wrap express app for Netlify
module.exports.handler = serverless(app);
