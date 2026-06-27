const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // ISP Block Torne Ke Liye

const express = require('express');
const mongoose = require('mongoose'); 
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path'); 
const connectDB = require('./config/db.js');
const User = require('./models/User'); // User model for dashboard operations

dotenv.config();
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Frontend aur Uploads folders ka setup
app.use(express.static(path.join(__dirname, 'front')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 

// 🛣️ ORIGINAL ROUTES CONNECTIVITY (Safe & Clean)
app.use('/api/auth', require('./routes/auth'));               
app.use('/api/novels', require('./routes/novelRoutes'));           
app.use('/api/chapters', require('./routes/chapterRoutes'));   

// 👥 NAYE ADMIN & USER MANAGEMENT ROUTES (Dashboard Se Perfectly Synced)

// 1. Saare Users Ka Data Dekhne Ke Liye
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, '-password'); 
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Users list nahi mil saki" });
    }
});

// 2. User Ko Block / Unblock Karne Ke Liye
app.patch('/api/users/:id/toggle-block', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: "User nahi mila" });

        user.isBlocked = !user.isBlocked; 
        await user.save();
        res.json({ message: "User status updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Status change nahi ho saki" });
    }
});

// 3. User Ko Humesha Ke Liye Delete Karne Ke Liye
app.delete('/api/users/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: "User deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "User delete nahi ho saka" });
    }
});

// 4. Live Counter Stats (Total Novels, Chapters, Users)
app.get('/api/analytics/system', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        
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

// Port Listener
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`🔥 Server is running smoothly on port ${PORT}`);
});