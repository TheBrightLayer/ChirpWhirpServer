const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const categoryRoutes = require("./routes/categoryRoutes");
const cors = require("cors");
const prerender = require("prerender-node"); // 👈 add this

dotenv.config();
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
    origin: ["http://localhost:5173", "https://thebrightlayer.com"],
    credentials: true,
  })
);

// ✅ Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/blogs", require("./routes/blogRoutes"));
app.use("/api/categories", categoryRoutes);

app.get("/", (req, res) => {
  res.send("🚀 Blog API running...");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`⚡ Server running on http://localhost:${PORT}`)
);
