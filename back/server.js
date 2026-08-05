const dns = require('dns');
const dotenv = require('dotenv');
dotenv.config(); // dotenv ko upar le aayein taake process.env pehle load ho jaye

// Agar environment local hai (development), sirf tab DNS change karein
if (process.env.NODE_ENV !== 'production') {
    dns.setServers(['8.8.8.8', '8.8.4.4']); // Local machine par ISP block torne ke liye
    console.log("🛠️ Local DNS Active (ISP Bypass)");
}

const express = require('express');
const mongoose = require('mongoose'); 
const cors = require('cors');
const path = require('path'); 
const multer = require('multer');

// Image upload storage configuration (Uploads folder)
const upload = multer({ dest: 'uploads/' });

const connectDB = require('./config/db.js');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 📈 EXTRA FEATURE: OVERALL WEBSITE VIEWS TRACKER (Global Counter)
async function trackWebsiteVisit() {
    try {
        const db = mongoose.connection.db;
        if (!db) return; // Guard clause

        await db.collection('site_stats').updateOne(
            { _id: 'global_views' },
            { $inc: { count: 1 } },
            { upsert: true }
        );
    } catch (err) {
        console.log("Global counter error:", err.message);
    }
}

app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.includes('.')) {
        trackWebsiteVisit();
    }
    next();
});

// Frontend aur Uploads folders ka setup
app.use(express.static(path.join(__dirname, 'front')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 🛣️ ORIGINAL ROUTES CONNECTIVITY
app.use('/api/auth', require('./routes/auth'));
app.use('/api/novels', require('./routes/novelRoutes'));
app.use('/api/chapters', require('./routes/chapterRoutes'));

// 📝 NOVEL EDIT & COVER UPDATE ROUTES
// 1. Edit Novel Text Details
app.patch('/api/novels/:id', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { title, author, contentType, status, description } = req.body;

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (author !== undefined) updateData.author = author;
        if (contentType !== undefined) updateData.contentType = contentType;
        if (status !== undefined) updateData.status = status;
        if (description !== undefined) updateData.description = description;

        await db.collection('novels').updateOne(
            { _id: new mongoose.Types.ObjectId(req.params.id) },
            { $set: updateData }
        );

        res.json({ success: true, message: "Novel details updated successfully!" });
    } catch (err) {
        console.error("Edit Novel Error:", err);
        res.status(500).json({ error: "Novel details update nahi ho sakin." });
    }
});

// 2. Update Novel Cover Image
// 2. Update Novel Cover Image (FIXED PATH)
app.patch('/api/novels/:id/update-cover', upload.single('coverImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Koi image file select nahi ki gayi." });
        }

        const db = mongoose.connection.db;
        
        // Exact static path for front-end access
        const newCoverUrl = `/uploads/${req.file.filename}`;

        await db.collection('novels').updateOne(
            { _id: new mongoose.Types.ObjectId(req.params.id) },
            { $set: { coverImage: newCoverUrl } }
        );

        res.json({ 
            success: true, 
            coverImage: newCoverUrl, 
            message: "Cover photo updated successfully!" 
        });
    } catch (err) {
        console.error("Cover Upload Error:", err);
        res.status(500).json({ error: "Cover update fail ho gaya." });
    }
});

// 👥 ADMIN & USER MANAGEMENT ROUTES
app.get('/api/users', async (req, res) => {
    try {
        const users = await mongoose.model('User').find({}, '-password'); 
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Users list nahi mil saki" });
    }
});

app.patch('/api/users/:id/toggle-block', async (req, res) => {
    try {
        const user = await mongoose.model('User').findById(req.params.id);
        if (!user) return res.status(404).json({ error: "User nahi mila" });
        user.isBlocked = !user.isBlocked; 
        await user.save();
        res.json({ message: "User status updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Status change nahi ho saki" });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await mongoose.model('User').findByIdAndDelete(req.params.id);
        res.json({ message: "User deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "User delete nahi ho saka" });
    }
});

app.get('/api/analytics/system', async (req, res) => {
    try {
        const totalUsers = await mongoose.model('User').countDocuments();
        let totalNovels = 0, totalChapters = 0, novelViewsTotal = 0, overallWebsiteViews = 0;

        try {
            const db = mongoose.connection.db;
            if (db) {
                totalNovels = await db.collection('novels').countDocuments();
                totalChapters = await db.collection('chapters').countDocuments();
                const novelsList = await db.collection('novels').find({}).toArray();
                novelViewsTotal = novelsList.reduce((sum, novel) => sum + (novel.views || 0), 0);
                const globalStats = await db.collection('site_stats').findOne({ _id: 'global_views' });
                overallWebsiteViews = globalStats ? globalStats.count : 0;
            }
        } catch (dbErr) {
            console.log("Analytics collections fetch fallback active");
        }

        res.json({
            totalViews: novelViewsTotal,          
            overallWebsiteViews: overallWebsiteViews, 
            totalNovels,
            totalChapters,
            totalUsers
        });
    } catch (err) {
        res.status(500).json({ error: "Analytics load nahi ho saki" });
    }
});

app.post('/api/admin/verify', (req, res) => {
    const { password } = req.body;
    const securePassword = process.env.ADMIN_PASSWORD || "Hamza786"; 
    if (password === securePassword) return res.json({ success: true });
    return res.status(401).json({ success: false, error: "Galat Password!" });
});

// 🔥 SAFEST WAY TO START SERVER (Wait for DB first)
const startServer = async () => {
    try {
        // Pehle database connect hone ka poora wait karein
        await connectDB(); 

        // Jab DB kamyab ho jaye, tab port open karein taake Render ko kharab response na jaye
        const PORT = process.env.PORT || 5001;
        app.listen(PORT, () => {
            console.log(`🔥 Server is running smoothly on port ${PORT}`);
        });
    } catch (error) {
        error.message ? console.error("❌ Server initialization failed:", error.message) : console.error("❌ Server initialization failed");
    }
};

startServer();