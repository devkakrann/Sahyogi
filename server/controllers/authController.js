const users = require("../models/userModel");

exports.signup = (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const existingUser = users.find((user) => user.email === email);

  if (existingUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  const user = {
    id: Date.now(),
    name,
    email,
    password,
    role,
  };

  users.push(user);

  return res.json({ message: "User registered successfully" });
};

exports.login = (req, res) => {
  const { email, password } = req.body;

  const user = users.find(
    (item) => item.email === email && item.password === password
  );

  if (!user) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  return res.json({
    message: "Login successful",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};
