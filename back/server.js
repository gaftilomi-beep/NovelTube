const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // ISP Block Torne Ke Liye[cite: 2]

const express = require('express');
const mongoose = require('mongoose'); // 🔥 Safe rendering aur dashboard queries ke liye
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path'); 
const connectDB = require('./config/db.js'); //[cite: 2]

dotenv.config(); //[cite: 2]
connectDB(); //[cite: 2]

const app = express(); //[cite: 2]

// Middlewares[cite: 2]
app.use(cors()); //[cite: 2]
app.use(express.json()); //[cite: 2]

// Frontend aur Uploads folders ka setup[cite: 2]
app.use(express.static(path.join(__dirname, 'front'))); //[cite: 2]
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); //[cite: 2]

// 🛣️ ORIGINAL ROUTES CONNECTIVITY (Bilkul Mehfooz Aur Un-touched)[cite: 2]
app.use('/api/auth', require('./routes/auth')); //[cite: 2]
app.use('/api/novels', require('./routes/novelRoutes')); //[cite: 2]
app.use('/api/chapters', require('./routes/chapterRoutes')); //[cite: 2]

// 👥 ADMIN & USER MANAGEMENT ROUTES (100% Crash Proof for Render)

// 1. Saare Users Ka Data Dekhne Ke Liye
app.get('/api/users', async (req, res) => {
    try {
        // Direct Mongoose model call bina kisi required file ke taake Render crash na ho
        const users = await mongoose.model('User').find({}, '-password'); 
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Users list nahi mil saki" });
    }
});

// 2. User Ko Block / Unblock Karne Ke Liye
app.patch('/api/users/:id/toggle-block', async (req, res) => {
    try {
        const user = await mongoose.model('User').findById(req.params.id);
        if (!user) return res.status(404).json({ error: "User nahi mila" });

        user.isBlocked = !user.isBlocked; // Status true/false flip
        await user.save();
        res.json({ message: "User status updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Status change nahi ho saki" });
    }
});

// 3. User Ko Humesha Ke Liye Delete Karne Ke Liye
app.delete('/api/users/:id', async (req, res) => {
    try {
        await mongoose.model('User').findByIdAndDelete(req.params.id);
        res.json({ message: "User deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "User delete nahi ho saka" });
    }
});

// 4. Live Counter Stats (Total Novels, Chapters, Users)
app.get('/api/analytics/system', async (req, res) => {
    try {
        const totalUsers = await mongoose.model('User').countDocuments();
        
        let totalNovels = 0;
        let totalChapters = 0;
        try {
            totalNovels = await mongoose.connection.db.collection('novels').countDocuments();
            totalChapters = await mongoose.connection.db.collection('chapters').countDocuments();
        } catch (dbErr) {
            console.log("Analytics collections fetch fallback active");
        }

        res.json({
            totalViews: 0, 
            totalNovels,
            totalChapters,
            totalUsers
        });
    } catch (err) {
        res.status(500).json({ error: "Analytics load nahi ho saki" });
    }
});

// Port Listener[cite: 2]
const PORT = process.env.PORT || 5001; //[cite: 2]
app.listen(PORT, () => {
    console.log(`🔥 Server is running smoothly on port ${PORT}`); //[cite: 2]
});