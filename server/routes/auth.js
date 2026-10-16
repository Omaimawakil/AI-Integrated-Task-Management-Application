const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Accepts name@domain.tld
const EMAIL_RE = /^[^\s@]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

router.post("/register", async (req, res) => {
  const name = String(req.body.name ?? "").trim();
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");

  if (!name || !password) {
    return res.status(400).json({ message: "Please fill in all fields" });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ message: "Please enter a valid email address" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });
    // Never send the password hash back to the browser.
    res.json({ id: user._id, name: user.name, email: user.email });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Email already registered" });
    }
    console.error(err);
    res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  const email = String(req.body.email ?? "").trim();
  const password = String(req.body.password ?? "");

  // New accounts are stored in lowercase; the fallback keeps older accounts working.
  const user =
    (await User.findOne({ email: email.toLowerCase() })) ||
    (await User.findOne({ email }));

  if (!user) {
    return res.status(400).json({
      message: "User not found"
    });
  }

  const valid = await bcrypt.compare(
    password,
    user.password
  );

  if (!valid) {
    return res.status(400).json({
      message: "Wrong Password"
    });
  }

  const token = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET
  );

  res.json({ token });
});

module.exports = router;