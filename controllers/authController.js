const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library"); // Google
const fetch = require("node-fetch"); // Facebook API

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ---------------- Helper ----------------
const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// ---------------- Email/Password ----------------
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = generateToken(user);

    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        profilePicture: user.profilePicture,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.register = async (req, res) => {
  const { username, email, password, role } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    user = new User({
      username,
      email,
      password: hashedPassword,
      role: role || "reader",
    });

    await user.save();

    const token = generateToken(user);

    res.status(201).json({
      msg: "✅ User registered successfully",
      token,
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        profilePicture: user.profilePicture,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// ---------------- Social Login ----------------
exports.loginWithGoogle = async (req, res) => {
  const { idToken } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const username = payload.name || email.split("@")[0];

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email, username, role: "reader" });
    }

    const token = generateToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(400).json({ msg: "Google login failed", error: err });
  }
};

exports.loginWithFacebook = async (req, res) => {
  const { accessToken, userID } = req.body;
  try {
    const response = await fetch(
      `https://graph.facebook.com/${userID}?fields=id,name,email&access_token=${accessToken}`
    );
    const fbUser = await response.json();
    if (!fbUser.email)
      return res.status(400).json({ msg: "Facebook login failed" });

    let user = await User.findOne({ email: fbUser.email });
    if (!user) {
      user = await User.create({
        email: fbUser.email,
        username: fbUser.name,
        role: "reader",
      });
    }

    const token = generateToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(400).json({ msg: "Facebook login failed", error: err });
  }
};

exports.loginWithApple = async (req, res) => {
  const { identityToken, email, name } = req.body;
  try {
    // For Apple, verify identityToken with Apple API (skipped here for brevity)
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        username: name || email.split("@")[0],
        role: "reader",
      });
    }
    const token = generateToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(400).json({ msg: "Apple login failed", error: err });
  }
};

// ---------------- Profile / Password ----------------
exports.updateProfilePicture = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    user.profilePicture = req.file?.path || user.profilePicture;
    await user.save();
    res.json({
      msg: "✅ Profile picture updated",
      profilePicture: user.profilePicture,
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

exports.updateEmail = async (req, res) => {
  const { newEmail } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    const emailExists = await User.findOne({ email: newEmail });
    if (emailExists)
      return res.status(400).json({ msg: "Email already in use" });
    user.email = newEmail;
    await user.save();
    res.json({ msg: "📧 Email updated successfully", email: user.email });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ msg: "Current password is incorrect" });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ msg: "🔑 Password changed successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email, newPassword } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ msg: "🔒 Password reset successful" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// ---------------- Role APIs ----------------
exports.getUserRole = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "role username email profilePicture"
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user role", error: err });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!["admin", "reader", "writer"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { role },
      { new: true, runValidators: true }
    ).select("role");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Role updated successfully", role: user.role });
  } catch (err) {
    res.status(500).json({ message: "Error updating role", error: err });
  }
};
