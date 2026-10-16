const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const auth = require("../middleware/auth");

// Only accept fields we expect from the client.
const pick = (body) => {
  const out = {};
  for (const k of ["title", "description", "status"]) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
};

router.post("/", auth, async (req, res) => {
  const task = await Task.create({ ...pick(req.body), createdBy: req.user.id });
  res.json(task);
});

router.get("/", auth, async (req, res) => {
  const tasks = await Task.find({ createdBy: req.user.id });
  res.json(tasks);
});

router.put("/:id", auth, async (req, res) => {
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user.id },
    pick(req.body),
    { new: true }
  );
  if (!task) return res.status(404).json({ message: "Task not found" });
  res.json(task);
});

router.delete("/:id", auth, async (req, res) => {
  await Task.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
  res.json({ message: "Deleted" });
});

module.exports = router;
