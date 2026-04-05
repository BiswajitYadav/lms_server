import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./configs/mongodb.js";
import connectCloudinary from "./configs/cloudinary.js";
import userRouter from "./routes/userRoutes.js";
import educatorRouter from "./routes/educatorRoutes.js";
import courseRouter from "./routes/courseRoute.js";
import examRouter from "./routes/examRoutes.js";
import discussionRouter from "./routes/discussionRoutes.js";
import { clerkMiddleware } from "@clerk/express";
import { clerkWebhooks, stripeWebhooks } from "./controllers/webhooks.js";

// ----------------------------------
// Initialize App + DB connections
// ----------------------------------
const app = express();
await connectDB();
await connectCloudinary();

app.use((req, res, next) => {
  if (req.originalUrl === "/clerk" || req.originalUrl === "/stripe") {
    next(); // Skip for Clerk and Stripe
  } else {
    express.json()(req, res, next);
  }
});

app.use(cors({
  origin: "*",
}));

// ----------------------------------
// ✅ Webhook routes FIRST (must get raw body)
// ----------------------------------
app.post("/clerk", express.raw({ type: "application/json" }), clerkWebhooks);
app.post("/stripe", express.raw({ type: "application/json" }), stripeWebhooks);

// ----------------------------------
// ✅ Clerk middleware AFTER webhooks
// ----------------------------------
app.use(clerkMiddleware());

// ----------------------------------
// ✅ Normal JSON parser for other routes
// ----------------------------------
app.use(express.json());

// ----------------------------------
// API Routes
// ----------------------------------
app.get("/", (req, res) => res.send("API Working"));
app.use("/api/educator", educatorRouter);
app.use("/api/course", courseRouter);
app.use("/api/user", userRouter);
app.use("/api/exam", examRouter);
app.use("/api/discussion", discussionRouter);

// ----------------------------------
// ✅ Start server
// ----------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));