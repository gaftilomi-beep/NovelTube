// ============================================================
// NovelTube Backend Server
// ============================================================

require('dotenv').config();

const dns = require('dns');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

// ============================================================
// LOCAL DNS
// ============================================================

if (process.env.NODE_ENV !== 'production') {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    console.log('🛠️ Local DNS Active');
}

// ============================================================
// APP
// ============================================================

const app = express();

// ============================================================
// DATABASE IMPORT (Path fixed: ../config/db.js)
// ============================================================

const connectDB = require('../config/db.js');

// Database connection middleware for Serverless environment (MUST BE BEFORE ROUTES)
app.use(async (req, res, next) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            await connectDB();
        }
        next();
    } catch (error) {
        console.error('❌ Database Connection Error:', error);
        res.status(500).json({ success: false, error: 'Database connection failed' });
    }
});

// ============================================================
// MULTER FOR SERVER-SIDE IMAGE ROUTES
// ============================================================

const upload = multer({
    dest: path.join(__dirname, '../uploads'),
    limits: {
        fileSize: 15 * 1024 * 1024
    }
});

// ============================================================
// CORS
// ============================================================

const allowedOrigins = [
    'https://noveltube.netlify.app',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        console.log('⚠️ CORS request from:', origin);
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false,
    optionsSuccessStatus: 204
};

app.use((req, res, next) => {
    console.log(
        `📡 ${new Date().toISOString()} | ${req.method} ${req.originalUrl} | Origin: ${req.headers.origin || 'none'}`
    );
    next();
});

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// ============================================================
// BODY PARSERS
// ============================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// WEBSITE VIEW TRACKER
// ============================================================

async function trackWebsiteVisit() {
    try {
        const db = mongoose.connection.db;
        if (!db) return;

        await db.collection('site_stats').updateOne(
            { _id: 'global_views' },
            { $inc: { count: 1 } },
            { upsert: true }
        );
    } catch (error) {
        console.log('⚠️ Global counter error:', error.message);
    }
}

app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.includes('.')) {
        trackWebsiteVisit();
    }
    next();
});

// ============================================================
// STATIC FILES & UPLOADS
// ============================================================

app.use(express.static(path.join(__dirname, '../../front')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================================
// API ROUTES (Paths fixed: ../routes/...)
// ============================================================

app.use('/api/auth', require('../routes/auth'));
app.use('/api/novels', require('../routes/novelRoutes'));
app.use('/api/chapters', require('../routes/chapterRoutes'));

// ============================================================
// EDIT NOVEL
// ============================================================

app.patch('/api/novels/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid novel ID.' });
        }

        const { title, author, contentType, status, description, category } = req.body;
        const updateData = {};

        if (title !== undefined) updateData.title = title;
        if (author !== undefined) updateData.author = author;
        if (contentType !== undefined) updateData.contentType = contentType;
        if (status !== undefined) updateData.status = status;
        if (description !== undefined) updateData.description = description;
        if (category !== undefined) updateData.category = category;

        const updatedNovel = await mongoose.model('Novel').findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedNovel) {
            return res.status(404).json({ success: false, error: 'Novel nahi mila.' });
        }

        return res.json({
            success: true,
            message: 'Novel details updated successfully!',
            data: updatedNovel
        });
    } catch (error) {
        console.error('❌ Edit Novel Error:', error);
        return res.status(500).json({ success: false, error: 'Novel details update nahi ho sakin.' });
    }
});

// ============================================================
// UPDATE NOVEL COVER
// ============================================================

app.patch('/api/novels/:id/update-cover', upload.single('coverImage'), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid novel ID.' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Koi image file select nahi ki gayi.' });
        }

        const newCoverUrl = `/uploads/${req.file.filename}`;
        const updatedNovel = await mongoose.model('Novel').findByIdAndUpdate(
            req.params.id,
            { $set: { coverImage: newCoverUrl } },
            { new: true }
        );

        if (!updatedNovel) {
            return res.status(404).json({ success: false, error: 'Novel nahi mila.' });
        }

        return res.json({
            success: true,
            coverImage: newCoverUrl,
            message: 'Cover photo updated successfully!'
        });
    } catch (error) {
        console.error('❌ Cover Upload Error:', error);
        return res.status(500).json({ success: false, error: 'Cover update fail ho gaya.' });
    }
});

// ============================================================
// USERS & MANAGEMENT
// ============================================================

app.get('/api/users', async (req, res) => {
    try {
        const User = mongoose.model('User');
        const users = await User.find({}, '-password');
        return res.json(users);
    } catch (error) {
        console.error('❌ Users Error:', error);
        return res.status(500).json({ success: false, error: 'Users list nahi mil saki.' });
    }
});

app.patch('/api/users/:id/toggle-block', async (req, res) => {
    try {
        const User = mongoose.model('User');
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User nahi mila.' });
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        return res.json({ success: true, message: 'User status updated successfully!' });
    } catch (error) {
        console.error('❌ Toggle Block Error:', error);
        return res.status(500).json({ success: false, error: 'Status change nahi ho saki.' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const User = mongoose.model('User');
        const deletedUser = await User.findByIdAndDelete(req.params.id);

        if (!deletedUser) {
            return res.status(404).json({ success: false, error: 'User nahi mila.' });
        }

        return res.json({ success: true, message: 'User deleted successfully.' });
    } catch (error) {
        console.error('❌ Delete User Error:', error);
        return res.status(500).json({ success: false, error: 'User delete nahi ho saka.' });
    }
});

// ============================================================
// ANALYTICS
// ============================================================

app.get('/api/analytics/system', async (req, res) => {
    try {
        const User = mongoose.model('User');
        const Novel = mongoose.model('Novel');

        const totalUsers = await User.countDocuments();
        const totalNovels = await Novel.countDocuments();

        let totalChapters = 0;
        let novelViewsTotal = 0;
        let overallWebsiteViews = 0;

        const db = mongoose.connection.db;

        if (db) {
            totalChapters = await db.collection('chapters').countDocuments();
            const novels = await Novel.find({}, { views: 1 }).lean();
            novelViewsTotal = novels.reduce((sum, novel) => sum + (Number(novel.views) || 0), 0);

            const stats = await db.collection('site_stats').findOne({ _id: 'global_views' });
            overallWebsiteViews = stats ? Number(stats.count) || 0 : 0;
        }

        return res.json({
            success: true,
            totalViews: novelViewsTotal,
            overallWebsiteViews,
            totalNovels,
            totalChapters,
            totalUsers
        });
    } catch (error) {
        console.error('❌ Analytics Error:', error);
        return res.status(500).json({ success: false, error: 'Analytics load nahi ho saki.' });
    }
});

// ============================================================
// ADMIN VERIFY & HEALTH
// ============================================================

app.post('/api/admin/verify', (req, res) => {
    const password = req.body.password;
    const securePassword = process.env.ADMIN_PASSWORD || 'Hamza786';

    if (password === securePassword) {
        return res.json({ success: true });
    }

    return res.status(401).json({ success: false, error: 'Galat Password!' });
});

app.get('/api/health', (req, res) => {
    return res.json({
        success: true,
        message: 'NovelTube API is running 🚀',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        time: new Date().toISOString()
    });
});

// ============================================================
// 404 & ERROR HANDLING
// ============================================================

app.use('/api', (req, res) => {
    return res.status(404).json({
        success: false,
        error: 'API route not found',
        path: req.originalUrl
    });
});

app.use((error, req, res, next) => {
    console.error('🔥 GLOBAL SERVER ERROR:', error);

    if (error instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            error: `File upload error: ${error.message}`
        });
    }

    return res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
});

module.exports = app;