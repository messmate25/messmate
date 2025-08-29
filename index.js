// File: server.js

const express = require("express");
require("dotenv").config();


// --- Import Services ---
const { startDefaultMenuJob } = require("./services/cron.service");

// --- Import Routes ---
const authRoutes = require("./routes/auth.routes");
const studentRoutes = require("./routes/student.routes");
const adminRoutes = require("./routes/admin.routes");
const guestRoutes = require("./routes/guest.routes");

const app = express();

// --- Middleware ---
app.use(express.json());

const PORT = process.env.PORT || 8080;

// --- API Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/guest", guestRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("✅ Mess App Backend is running successfully!");
});

// --- Start Server with DB + Models ---
(async () => {
  try {

    startDefaultMenuJob();
    console.log("🕒 Cron job for default menu assignment scheduled.");

    // --- Start Express Server ---
    app.listen(PORT, () => {
      console.log(`🚀 Server is running at http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("❌ Failed to connect to DB or start server:", error);
    process.exit(1);
  }
})();
