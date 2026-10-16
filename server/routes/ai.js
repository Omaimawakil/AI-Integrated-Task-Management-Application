const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const auth = require("../middleware/auth");
const Task = require("../models/Task");
const ai = require("../services/ai");

const router = express.Router();

router.use(auth);

// The free Gemini tier is shared by all users, so keep the per-user cap low.
router.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    keyGenerator: (req) => String(req.user.id),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many AI requests. Please wait a minute." },
  })
);

const badRequest = (message) => {
  const err = new Error(message);
  err.status = 400;
  err.expose = true;
  return err;
};

// Never forward upstream status codes (a 401 from the AI provider would look
// like an expired login to your frontend).
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error("AI error:", err.message);
    if (err.expose) return res.status(err.status).json({ message: err.message });
    res.status(502).json({ message: "AI request failed. Please try again." });
  }
};

const myTasks = (req) =>
  Task.find({ createdBy: req.user.id }).sort({ _id: -1 }).limit(100).lean();

// POST /ai/breakdown  { taskId }  or  { title, description }
router.post(
  "/breakdown",
  handle(async (req, res) => {
    let { taskId, title, description } = req.body;
    if (taskId) {
      if (!mongoose.isValidObjectId(taskId)) throw badRequest("Invalid taskId");
      const task = await Task.findOne({ _id: taskId, createdBy: req.user.id });
      if (!task) throw Object.assign(badRequest("Task not found"), { status: 404 });
      ({ title, description } = task);
    }
    if (!title || !String(title).trim()) throw badRequest("A task title is required");
    res.json({ subtasks: await ai.breakdownTask({ title, description }) });
  })
);

// POST /ai/generate  { prompt }
router.post(
  "/generate",
  handle(async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || !String(prompt).trim()) throw badRequest("A prompt is required");
    res.json({ tasks: await ai.generateTasks(prompt) });
  })
);

// GET /ai/summary
router.get(
  "/summary",
  handle(async (req, res) => {
    const tasks = await myTasks(req);
    if (!tasks.length) return res.json({ summary: "You have no tasks yet." });
    res.json({ summary: await ai.summarizeTasks(tasks) });
  })
);

// POST /ai/ask  { message }
router.post(
  "/ask",
  handle(async (req, res) => {
    const { message } = req.body;
    if (!message || !String(message).trim()) throw badRequest("A message is required");
    res.json({ answer: await ai.askAboutTasks(await myTasks(req), message) });
  })
);

module.exports = router;
