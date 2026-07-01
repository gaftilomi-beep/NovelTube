const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const router = express.Router();
const JWT_SECRET = "aapka_koi_bhi_secret_key_ya_password"; // Isko baad mein .env mein dalenge

// 📝 1. SIGNUP ROUTE (Naye user ke liye)
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
        // 👇 YEH LINE ADD KARNA BOHT ZAROORI HAI BACKEND LOGS DEKHNE KE LIYE
        console.error("🚨 SIGNUP ERROR DETAILS:", error); 
        res.status(500).json({ error: "Server par koi masla hai!" });
    }
});

module.exports = router;