require("dotenv").config(); // <- MUST be first
const express = require("express");
const connectDB = require("./config/db");

// require other modules AFTER dotenv is loaded
const categoryRoutes = require("./routes/categoryRoutes");
const proposalRoutes = require("./routes/proposalRoutes");
const sendgridRoutes = require("./routes/sendGridRoutes");
const cors = require("cors");
const prerender = require("prerender-node");

connectDB();

const app = express();

// ✅ Prerender middleware (for bots like Google, Twitter, FB)
// app.use(
//   prerender.set("prerenderToken", process.env.PRERENDER_TOKEN) // token from prerender.io
// );

app.use(
  prerender
    .set("prerenderServiceUrl", "https://service.prerender.io/")
    .set("prerenderToken", process.env.PRERENDER_TOKEN) // from prerender.io
);
// ✅ CORS middleware
app.use(
  cors({
    origin: "*", // allow all origins
    credentials: true,
  })
);

// ✅ Body parsers
// server.js (near top, before app.use("/api", ...))
app.use(express.json({ limit: "10mb" })); // default was ~100kb
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ✅ Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/blogs", require("./routes/blogRoutes"));
app.use("/api/categories", categoryRoutes);
app.use("/api/proposal", proposalRoutes);
app.use("/api/sendMail", sendgridRoutes);

app.get("/", (req, res) => {
  res.send("🚀 Blog API running...");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`⚡ Server running on http://localhost:${PORT}`)
);
