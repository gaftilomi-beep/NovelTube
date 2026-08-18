// ============================================================
// NovelTube Backend Server
// ============================================================

require('dotenv').config();

const dns = require('dns');
const fs = require('fs');
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
// APP & UPLOAD DIRECTORY SETUP (/tmp for Render Cloud compatibility)
// ============================================================

const app = express();

const uploadsDir = path.join('/tmp', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// ============================================================
// DATABASE CONNECTION SETUP
// ============================================================

const connectDB = require('./config/db.js');

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

// Helper Function: Safe Model Fetching
const getModel = (modelName) => {
    try {
        return mongoose.model(modelName);
    } catch (e) {
        return null;
    }
};

// ============================================================
// MULTER STORAGE & FILE FILTER (Updated to 100MB+)
// ============================================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100 MB Limit Fixed
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/pdf',
            'application/octet-stream' // Large PDFs through forms
        ];
        if (allowedTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.pdf')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type! Sirf JPG, PNG, WEBP aur PDF files allowed hain.'));
        }
    }
});

// ============================================================
// CORS CONFIGURATION
// ============================================================

const allowedOrigins = [
    'https://noveltube.online',
    'https://www.noveltube.online',
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

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

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
// STATIC FILES & INLINE PDF SERVING
// ============================================================

const frontendPath = path.join(__dirname, '../front');
app.use(express.static(frontendPath));

app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
        if (filePath.toLowerCase().endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
        }
    }
}));

// ============================================================
// DYNAMIC FRONTEND ROUTES FOR NOVEL SLUGS
// ============================================================

app.get(['/novels/:slug', '/novel/:slug'], (req, res) => {
    res.sendFile(path.join(frontendPath, 'novel-detail.html'));
});

// ============================================================
// API ROUTES
// ============================================================

app.use('/api/auth', require('./routes/auth.js'));
app.use('/api/novels', require('./routes/novelRoutes.js'));
app.use('/api/chapters', require('./routes/chapterRoutes.js'));

// ============================================================
// EDIT NOVEL DETAILS
// ============================================================

app.patch('/api/novels/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid novel ID.' });
        }

        const Novel = getModel('Novel');
        if (!Novel) {
            return res.status(500).json({ success: false, error: 'Novel model load nahi ho saka.' });
        }

        const { title, author, contentType, status, description, category } = req.body;
        const updateData = {};

        if (title !== undefined) updateData.title = title;
        if (author !== undefined) updateData.author = author;
        if (contentType !== undefined) updateData.contentType = contentType;
        if (status !== undefined) updateData.status = status;
        if (description !== undefined) updateData.description = description;
        if (category !== undefined) updateData.category = category;

        const updatedNovel = await Novel.findByIdAndUpdate(
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

        const Novel = getModel('Novel');
        if (!Novel) {
            return res.status(500).json({ success: false, error: 'Novel model load nahi ho saka.' });
        }

        const newCoverUrl = `/uploads/${req.file.filename}`;
        const updatedNovel = await Novel.findByIdAndUpdate(
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
// USERS MANAGEMENT
// ============================================================

app.get('/api/users', async (req, res) => {
    try {
        const User = getModel('User');
        if (!User) return res.json([]);

        const users = await User.find({}, '-password');
        return res.json(users);
    } catch (error) {
        console.error('❌ Users Error:', error);
        return res.status(500).json({ success: false, error: 'Users list nahi mil saki.' });
    }
});

app.patch('/api/users/:id/toggle-block', async (req, res) => {
    try {
        const User = getModel('User');
        if (!User) return res.status(500).json({ success: false, error: 'User model not found' });

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
        const User = getModel('User');
        if (!User) return res.status(500).json({ success: false, error: 'User model not found' });

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
        const User = getModel('User');
        const Novel = getModel('Novel');

        const totalUsers = User ? await User.countDocuments() : 0;
        const totalNovels = Novel ? await Novel.countDocuments() : 0;

        let totalChapters = 0;
        let novelViewsTotal = 0;
        let overallWebsiteViews = 0;

        const db = mongoose.connection.db;

        if (db) {
            totalChapters = await db.collection('chapters').countDocuments();
            if (Novel) {
                const novels = await Novel.find({}, { views: 1 }).lean();
                novelViewsTotal = novels.reduce((sum, novel) => sum + (Number(novel.views) || 0), 0);
            }

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
// 404 & GLOBAL ERROR HANDLING
// ============================================================

app.use('/api', (req, res) => {
    return res.status(404).json({
        success: false,
        error: 'API route not found',
        path: req.originalUrl
    });
});

// Fallback serve index.html for non-API client routes (Express v5 / path-to-regexp v8 fix)
app.get('/*splat', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((error, req, res, next) => {
    console.error('🔥 GLOBAL SERVER ERROR:', error);

    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File size limit exeed ho gayi hai (Max 100MB allowed).'
            });
        }
        return res.status(400).json({
            success: false,
            error: `File upload error: ${error.message}`
        });
    }

    return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
});

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`🚀 Server successfully running on port ${PORT}`);
});

module.exports = app;