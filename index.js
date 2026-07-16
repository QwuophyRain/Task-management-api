const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const NodeCache = require("node-cache");
const { body, validationResult } = require("express-validator");
require("dotenv").config();

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(cors());

const cache = new NodeCache({ stdTTL: 600 });

const connectDB = async () => {
  try {
    const mongoURI =process.env.MONGO_URL;

    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  } catch (error) {
    console.error("MongoDB connection error");
    process.exit(1);
  }
};

// Model creation
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  completed: { type: Boolean, default: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Task = mongoose.model("Task", taskSchema);

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

// vaildator
const validateTask = [
  body("title").isString().notEmpty().trim().isLength({ min: 3 }),
  body("completed").isBoolean(),
];

// JWT middleware
const auth = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", " ");
  if (!token) return res.status(401).json({ error: "Access denied" });
  try {
    const decode = jwt.verify(token, "secret-key");
    req.user = decode;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

//signup route
// User Signup Endpoint
app.post(
  "/signup",
  [
    body("username").isString().notEmpty().trim().isLength({ min: 3, max: 30 }),
    body("password").isString().notEmpty().isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Create new user
      const user = new User({
        username,
        password, // In production, you should hash the password
      });

      await user.save();

      // Generate JWT token
      const token = jwt.sign({ id: user._id }, "secret-key", {
        expiresIn: "1h",
      });

      res.status(201).json({
        message: "User created successfully",
        token,
        user: {
          id: user._id,
          username: user.username,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  }
);

// user login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ id: user._id }, "secret-key", { expiresIn: "1h" });
  res.json({ token });
});

// Get all tasks (protected)
app.get("/tasks", auth, async (req, res) => {
  const cacheKey = `all_tasks_${req.user.id}`;
  const cachedTasks = cache.get(cacheKey);

  if (cachedTasks) return res.json(cachedTasks);

  const tasks = await Task.find({ userId: req.user.id }).sort({ createdAt: -1 });
  cache.set(cacheKey, tasks);
  res.json(tasks);
});

// Create new task
app.post("/tasks", [auth, ...validateTask], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const task = new Task({
    ...req.body,
    userId: req.user.id
  });
  await task.save();
  // Invalidate cache
  cache.del(`all_tasks_${req.user.id}`);
  res.status(201).json(task);
});

// Get Task by ID (protected)
app.get("/tasks/:id", auth, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user.id });
    if (!task) {
      return res.status(404).json({
        error: "Task not found",
        message: "No task exists with the provided ID",
      });
    }
    res.json({
      message: "Task retrieved successfully!",
      task,
    });
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({
      error: "Failed to fetch task",
      details: error.message,
    });
  }
});

// Update Task
app.put("/tasks/:id", [auth, ...validateTask], async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    if (!task) return res.status(404).json({ error: "Task not found" });

    cache.del(`all_tasks_${req.user.id}`);
    res.json({ message: "Task updated successfully", task });
  } catch (error) {
    res.status(500).json({ error: "Failed to update task" });
  }
});

// Delete Task
app.delete("/tasks/:id", auth, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!task) return res.status(404).json({ error: "Task not found" });

    cache.del(`all_tasks_${req.user.id}`);
    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", uptime: process.uptime() });
});

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📋 Task API endpoints:`);
      console.log(`   POST   /login      - User login (get JWT token)`);
      console.log(`   GET    /tasks      - Get all tasks (JWT required)`);
      console.log(`   POST   /tasks      - Create new task (validation)`);
      console.log(`   GET    /tasks/:id  - Get task by ID`);
      console.log(`   PUT    /tasks/:id  - Update task (JWT required)`);
      console.log(`   DELETE /tasks/:id  - Delete task`);
      console.log(`   GET    /health     - Health check`);
      console.log(`🔐 Authentication:`);
      console.log(`   Use: Authorization: Bearer <token>`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

module.exports = app;

// Start only if run directly
if (require.main === module) {
  startServer();
}
