const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // ISP Block Torne Ke Liye

const express = require('express');
const mongoose = require('mongoose'); // 🔥 Safe rendering aur dashboard queries ke liye
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path'); 

dotenv.config();
const connectDB = require('./config/db.js');
connectDB();
// back/server.js mein connectDB(); ke bilkul niche yeh paste karein:
mongoose.connection.once('open', async () => {
    try {
        // Yeh novel collection se category ka hidden unique check mita dega
        await mongoose.connection.db.collection('novels').dropIndex('category_1');
        console.log("✅ Category ka hidden unique index kamyabi se khatam ho gaya!");
    } catch (err) {
        // Agar index pehle se nahi hoga toh error bypass ho jayega
        console.log("Index clean ya pehle se dropped hai.");
    }
});

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// 📈 EXTRA FEATURE: OVERALL WEBSITE VIEWS TRACKER (Global Counter)
// Jab bhi koi banda website par visit karega (index.html load karega), yeh automatic database me count badhaega
let websiteViewsCounter = 0;

// Background tracker function jo database me save karega
async function trackWebsiteVisit() {
    try {
        const db = mongoose.connection.db;
        // Ek simple collection banayein 'site_stats' ke naam se
        await db.collection('site_stats').updateOne(
            { _id: 'global_views' },
            { $inc: { count: 1 } },
            { upsert: true }
        );
    } catch (err) {
        console.log("Global counter error:", err.message);
    }
}

// Middleware jo har page visit ko track karega lekin API calls ko chhor kar
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

// 👥 ADMIN & USER MANAGEMENT ROUTES

// 1. Saare Users Ka Data Dekhne Ke Liye
app.get('/api/users', async (req, res) => {
    try {
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

// 4. 🔥 UPDATED LIVE COUNTER STATS (Total Novels, Chapters, Users, Novel Views & Overall Website Views)
app.get('/api/analytics/system', async (req, res) => {
    try {
        const totalUsers = await mongoose.model('User').countDocuments();
        
        let totalNovels = 0;
        let totalChapters = 0;
        let novelViewsTotal = 0;
        let overallWebsiteViews = 0;

        try {
            const db = mongoose.connection.db;
            totalNovels = await db.collection('novels').countDocuments();
            totalChapters = await db.collection('chapters').countDocuments();
            
            // 📊 1. Saare Novels Ke Views Ko Plus (+) Kar Ke Total Nikalein
            const novelsList = await db.collection('novels').find({}).toArray();
            novelViewsTotal = novelsList.reduce((sum, novel) => sum + (novel.views || 0), 0);

            // 🌐 2. Overall Website Visited Views Ko Database Se Uthayein
            const globalStats = await db.collection('site_stats').findOne({ _id: 'global_views' });
            overallWebsiteViews = globalStats ? globalStats.count : 0;

        } catch (dbErr) {
            console.log("Analytics collections fetch fallback active");
        }

        // Dashboard ko dono kism ke views bhej rahe hain!
        res.json({
            totalViews: novelViewsTotal,          // Novels par total kitne clicks aaye
            overallWebsiteViews: overallWebsiteViews, // 👈 Overall website par kitne log aaye (Chahe novel dekha ya nahi)
            totalNovels,
            totalChapters,
            totalUsers
        });
    } catch (err) {
        res.status(500).json({ error: "Analytics load nahi ho saki" });
    }
});

// 🔒 SECURE ADMIN PASSWORD VERIFICATION ENDPOINT
app.post('/api/admin/verify', (req, res) => {
    const { password } = req.body;
    const securePassword = process.env.ADMIN_PASSWORD || "Hamza786"; 

    if (password === securePassword) {
        return res.json({ success: true });
    } else {
        return res.status(401).json({ success: false, error: "Galat Password!" });
    }
});

// Port Listener
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`🔥 Server is running smoothly on port ${PORT}`);
});