// ============================================================
// NovelTube Backend Server
// ============================================================

const dns = require('dns');
const dotenv = require('dotenv');

dotenv.config();

// ============================================================
// LOCAL DNS CONFIGURATION
// ============================================================

if (process.env.NODE_ENV !== 'production') {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    console.log('🛠️ Local DNS Active (ISP Bypass)');
}

// ============================================================
// IMPORTS
// ============================================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

// ============================================================
// APP
// ============================================================

const app = express();

// ============================================================
// MULTER - FILE UPLOAD
// ============================================================

const upload = multer({
    dest: path.join(__dirname, 'uploads/')
});

// ============================================================
// DATABASE
// ============================================================

const connectDB = require('./config/db.js');

// ============================================================
// CORS CONFIGURATION
// ============================================================

// IMPORTANT:
// Ye actual URLs hain.
// Inhein [URL](URL) format mein NA likhna.

const allowedOrigins = [
    'https://noveltube.netlify.app',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
];

const corsOptions = {
    origin: function (origin, callback) {

        // Browser ke baghair requests:
        // Postman, curl, server-to-server etc.
        if (!origin) {
            return callback(null, true);
        }

        // Allowed frontend
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // ----------------------------------------------------
        // TEMPORARY SAFE FALLBACK
        // ----------------------------------------------------
        // NovelTube frontend ko CORS ki wajah se block hone se
        // bachane ke liye unknown origins ko bhi allow kar rahe hain.
        //
        // Agar website stable ho jaye to isko restrict kiya
        // ja sakta hai.
        // ----------------------------------------------------

        console.log('🌐 CORS Request From:', origin);
        return callback(null, true);
    },

    methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS'
    ],

    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With'
    ],

    credentials: true,

    optionsSuccessStatus: 204
};

// IMPORTANT:
// CORS middleware routes se PEHLE hona chahiye.

app.use(cors(corsOptions));

// Explicit preflight handling
app.options(/.*/, cors(corsOptions));

// ============================================================
// BODY PARSERS
// ============================================================

app.use(express.json({ limit: '10mb' }));

app.use(
    express.urlencoded({
        extended: true,
        limit: '10mb'
    })
);

// ============================================================
// WEBSITE GLOBAL VIEW TRACKER
// ============================================================

async function trackWebsiteVisit() {
    try {
        const db = mongoose.connection.db;

        if (!db) {
            return;
        }

        await db.collection('site_stats').updateOne(
            { _id: 'global_views' },
            {
                $inc: {
                    count: 1
                }
            },
            {
                upsert: true
            }
        );

    } catch (err) {
        console.log(
            '⚠️ Global counter error:',
            err.message
        );
    }
}

// ============================================================
// GLOBAL VISIT MIDDLEWARE
// ============================================================

app.use((req, res, next) => {

    // Sirf website pages ke visits count karein.
    // API calls aur files ko global website view na banayein.

    if (
        !req.path.startsWith('/api') &&
        !req.path.includes('.')
    ) {
        trackWebsiteVisit();
    }

    next();
});

// ============================================================
// STATIC FRONTEND
// ============================================================

app.use(
    express.static(
        path.join(__dirname, 'front')
    )
);

// ============================================================
// STATIC UPLOADS
// ============================================================

app.use(
    '/uploads',
    express.static(
        path.join(__dirname, 'uploads')
    )
);

// ============================================================
// API ROUTES
// ============================================================

// Authentication
app.use(
    '/api/auth',
    require('./routes/auth')
);

// Novels
app.use(
    '/api/novels',
    require('./routes/novelRoutes')
);

// Chapters
app.use(
    '/api/chapters',
    require('./routes/chapterRoutes')
);

// ============================================================
// EDIT NOVEL DETAILS
// ============================================================

app.patch('/api/novels/:id', async (req, res) => {

    try {

        const db = mongoose.connection.db;

        if (!db) {
            return res.status(503).json({
                error: 'Database available nahi hai.'
            });
        }

        const {
            title,
            author,
            contentType,
            status,
            description
        } = req.body;

        const updateData = {};

        if (title !== undefined) {
            updateData.title = title;
        }

        if (author !== undefined) {
            updateData.author = author;
        }

        if (contentType !== undefined) {
            updateData.contentType = contentType;
        }

        if (status !== undefined) {
            updateData.status = status;
        }

        if (description !== undefined) {
            updateData.description = description;
        }

        await db.collection('novels').updateOne(
            {
                _id: new mongoose.Types.ObjectId(
                    req.params.id
                )
            },
            {
                $set: updateData
            }
        );

        res.json({
            success: true,
            message: 'Novel details updated successfully!'
        });

    } catch (err) {

        console.error(
            '❌ Edit Novel Error:',
            err
        );

        res.status(500).json({
            error: 'Novel details update nahi ho sakin.'
        });
    }
});

// ============================================================
// UPDATE NOVEL COVER
// ============================================================

app.patch(
    '/api/novels/:id/update-cover',
    upload.single('coverImage'),
    async (req, res) => {

        try {

            if (!req.file) {
                return res.status(400).json({
                    error: 'Koi image file select nahi ki gayi.'
                });
            }

            const db = mongoose.connection.db;

            if (!db) {
                return res.status(503).json({
                    error: 'Database available nahi hai.'
                });
            }

            // Browser ke liye relative URL
            const newCoverUrl =
                `/uploads/${req.file.filename}`;

            await db.collection('novels').updateOne(
                {
                    _id: new mongoose.Types.ObjectId(
                        req.params.id
                    )
                },
                {
                    $set: {
                        coverImage: newCoverUrl
                    }
                }
            );

            res.json({
                success: true,
                coverImage: newCoverUrl,
                message: 'Cover photo updated successfully!'
            });

        } catch (err) {

            console.error(
                '❌ Cover Upload Error:',
                err
            );

            res.status(500).json({
                error: 'Cover update fail ho gaya.'
            });
        }
    }
);

// ============================================================
// USER MANAGEMENT
// ============================================================

// Get users
app.get('/api/users', async (req, res) => {

    try {

        const User = mongoose.model('User');

        const users = await User.find(
            {},
            '-password'
        );

        res.json(users);

    } catch (err) {

        console.error(
            '❌ Users Fetch Error:',
            err
        );

        res.status(500).json({
            error: 'Users list nahi mil saki'
        });
    }
});

// ============================================================
// BLOCK / UNBLOCK USER
// ============================================================

app.patch(
    '/api/users/:id/toggle-block',
    async (req, res) => {

        try {

            const User = mongoose.model('User');

            const user = await User.findById(
                req.params.id
            );

            if (!user) {
                return res.status(404).json({
                    error: 'User nahi mila'
                });
            }

            user.isBlocked = !user.isBlocked;

            await user.save();

            res.json({
                success: true,
                message: 'User status updated successfully!'
            });

        } catch (err) {

            console.error(
                '❌ Toggle Block Error:',
                err
            );

            res.status(500).json({
                error: 'Status change nahi ho saki'
            });
        }
    }
);

// ============================================================
// DELETE USER
// ============================================================

app.delete(
    '/api/users/:id',
    async (req, res) => {

        try {

            const User = mongoose.model('User');

            await User.findByIdAndDelete(
                req.params.id
            );

            res.json({
                success: true,
                message: 'User deleted successfully'
            });

        } catch (err) {

            console.error(
                '❌ Delete User Error:',
                err
            );

            res.status(500).json({
                error: 'User delete nahi ho saka'
            });
        }
    }
);

// ============================================================
// SYSTEM ANALYTICS
// ============================================================

app.get(
    '/api/analytics/system',
    async (req, res) => {

        try {

            const User = mongoose.model('User');

            const totalUsers =
                await User.countDocuments();

            let totalNovels = 0;
            let totalChapters = 0;
            let novelViewsTotal = 0;
            let overallWebsiteViews = 0;

            try {

                const db = mongoose.connection.db;

                if (db) {

                    totalNovels =
                        await db
                            .collection('novels')
                            .countDocuments();

                    totalChapters =
                        await db
                            .collection('chapters')
                            .countDocuments();

                    const novelsList =
                        await db
                            .collection('novels')
                            .find({})
                            .toArray();

                    novelViewsTotal =
                        novelsList.reduce(
                            (sum, novel) =>
                                sum +
                                (Number(novel.views) || 0),
                            0
                        );

                    const globalStats =
                        await db
                            .collection('site_stats')
                            .findOne({
                                _id: 'global_views'
                            });

                    overallWebsiteViews =
                        globalStats
                            ? Number(globalStats.count) || 0
                            : 0;
                }

            } catch (dbErr) {

                console.log(
                    '⚠️ Analytics DB fallback:',
                    dbErr.message
                );
            }

            res.json({

                // Dashboard Genuine Total Views
                totalViews: novelViewsTotal,

                // Overall website views
                overallWebsiteViews,

                totalNovels,

                totalChapters,

                totalUsers
            });

        } catch (err) {

            console.error(
                '❌ Analytics Error:',
                err
            );

            res.status(500).json({
                error: 'Analytics load nahi ho saki'
            });
        }
    }
);

// ============================================================
// ADMIN PASSWORD VERIFY
// ============================================================

app.post(
    '/api/admin/verify',
    (req, res) => {

        const {
            password
        } = req.body;

        const securePassword =
            process.env.ADMIN_PASSWORD ||
            'Hamza786';

        if (password === securePassword) {

            return res.json({
                success: true
            });
        }

        return res.status(401).json({
            success: false,
            error: 'Galat Password!'
        });
    }
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/api/health', (req, res) => {

    res.json({
        success: true,
        message: 'NovelTube API is running 🚀',
        database:
            mongoose.connection.readyState === 1
                ? 'connected'
                : 'disconnected',
        time: new Date().toISOString()
    });

});

// ============================================================
// 404 API HANDLER
// ============================================================

app.use('/api', (req, res) => {

    res.status(404).json({
        success: false,
        error: 'API route not found',
        path: req.originalUrl
    });

});

// ============================================================
// GENERAL ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {

    console.error(
        '🔥 GLOBAL SERVER ERROR:',
        err
    );

    // Agar multer ka error hai
    if (err instanceof multer.MulterError) {

        return res.status(400).json({
            success: false,
            error: `File upload error: ${err.message}`
        });
    }

    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// ============================================================
// START SERVER
// ============================================================

const startServer = async () => {

    try {

        // Database pehle connect hogi
        await connectDB();

        console.log(
            '✅ MongoDB Connected Successfully'
        );

        const PORT =
            process.env.PORT || 5001;

        app.listen(
            PORT,
            '0.0.0.0',
            () => {

                console.log(
                    `🔥 NovelTube Server running on port ${PORT}`
                );

                console.log(
                    `🌐 CORS Frontend: https://noveltube.netlify.app`
                );

                console.log(
                    `📚 API Base: /api`
                );
            }
        );

    } catch (error) {

        console.error(
            '❌ Server initialization failed:',
            error.message || error
        );

        process.exit(1);
    }
};

startServer();