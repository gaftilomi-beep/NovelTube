const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const router = express.Router();
const JWT_SECRET = "aapka_koi_bhi_secret_key_ya_password"; // Isko baad mein .env mein dalenge

// 📝 1. SIGNUP ROUTE (Naye user ke liye)
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check karein ke user pehle se toh nahi bana hua
        let userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ error: "Email pehle se registered hai!" });

        // Password ko encrypt (hash) karein
        const hashedPassword = await bcrypt.hash(password, 10);

        // Naya user save karein
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();

        // Login token banayein
        const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ message: "🎉 Signup Kamyab!", token, username });
    } catch (error) {
        res.status(500).json({ error: "Server par koi masla hai!" });
    }
});

// 🔑 2. LOGIN ROUTE (Purane user ke liye)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "Ghalat Email ya Password!" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Ghalat Email ya Password!" });

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({ message: "👋 Welcome Back!", token, username: user.username });
    } catch (error) {
        res.status(500).json({ error: "Server par koi masla hai!" });
    }
});

module.exports = router;