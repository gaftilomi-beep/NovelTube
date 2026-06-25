const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Novel = require('../models/Novel'); // Model ka path

const router = express.Router();

// 📂 Ensure 'uploads' folder exists automatically
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// ⚙️ Multer Configuration (PC se file save karne ke liye)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Is folder mein files save hongi
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// 📥 1. POST ROUTE: Novel aur Chapters upload karne ke liye
router.post('/', upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'mainPdf', maxCount: 1 },
    { name: 'chapterFiles', maxCount: 50 }
]), async (req, res) => {
    try {
        const { title, author, description, status, hasChapters, chapterTitles, category } = req.body;

        let coverImageUrl = '';
        if (req.files && req.files['coverImage']) {
            coverImageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.files['coverImage'][0].filename}`;
        }

        let mainPdfUrl = '';
        if (hasChapters === 'false' && req.files && req.files['mainPdf']) {
            mainPdfUrl = `${req.protocol}://${req.get('host')}/uploads/${req.files['mainPdf'][0].filename}`;
        }

        // Chapters processing logic
        let finalChapters = [];
        if (hasChapters === 'true' && req.files && req.files['chapterFiles']) {
            const titlesArray = Array.isArray(chapterTitles) ? chapterTitles : [chapterTitles];
            finalChapters = req.files['chapterFiles'].map((file, index) => ({
                chapterTitle: titlesArray[index] || `Chapter ${index + 1}`,
                chapterPdf: `${req.protocol}://${req.get('host')}/uploads/${file.filename}`
            }));
        }

        // Save to MongoDB
        const newNovel = new Novel({
            title,
            author: author || 'Unknown Writer',
            description,
            status,
            category: category || 'Newly Uploaded', // 🔥 Dynamic Category Feature
            hasChapters: hasChapters === 'true',
            coverImage: coverImageUrl,
            mainPdf: hasChapters === 'true' ? '' : mainPdfUrl,
            chapters: finalChapters
        });

        await newNovel.save();
        res.status(201).json({ message: '🎉 Novel published successfully!', data: newNovel });

    } catch (error) {
        console.error("🔥 Server Error:", error);
        res.status(500).json({ error: 'Database mein save nahi ho saka!', details: error.message });
    }
});

// 📤 2. GET ROUTE: Saare novels homepage par dikhane ke liye
router.get('/', async (req, res) => {
    try {
        const novels = await Novel.find().sort({ _id: -1 }); // Naye novels pehle dikhenge
        res.status(200).json(novels);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📤 3. GET SINGLE NOVEL ROUTE: ID ke zariye novel detail page ke liye
// 📤 3. GET SINGLE NOVEL ROUTE: Open hote hi view count +1 karo
router.get('/:id', async (req, res) => {
    try {
        // 🚀 findByIdAndUpdate ke zariye views ko automatic increment ($inc) karein
        const novel = await Novel.findByIdAndUpdate(
            req.params.id, 
            { $inc: { views: 1 } }, 
            { new: true }
        );

        if (!novel) {
            return res.status(404).json({ error: 'Novel nahi mila!' });
        }
        res.status(200).json(novel);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 🗑️ 4. DELETE ROUTE: Novel ko hamesha ke liye mitaane ke liye
router.delete('/:id', async (req, res) => {
    try {
        const deletedNovel = await Novel.findByIdAndDelete(req.params.id);
        if (!deletedNovel) {
            return res.status(404).json({ error: 'Novel nahi mila!' });
        }
        res.status(200).json({ message: '🎉 Novel database se hamesha ke liye delete ho gaya!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ➕ 5. UPDATE ROUTE: Kisi novel mein agla (Next) Chapter add karne ke liye
router.post('/:id/add-chapter', upload.single('chapterFile'), async (req, res) => {
    try {
        const { chapterTitle } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'Galti! Please chapter ki PDF file select karein.' });
        }

        // Naye chapter ka file URL
        const chapterPdfUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        // MongoDB ke array mein push ($push) karna
        const updatedNovel = await Novel.findByIdAndUpdate(
            req.params.id,
            {
                $push: {
                    chapters: {
                        chapterTitle: chapterTitle || `Chapter`,
                        chapterPdf: chapterPdfUrl
                    }
                }
            },
            { new: true } // Taaki updated data wapis mile
        );

        res.status(200).json({ message: '🎉 Naya chapter kamyabi se add ho gaya!', data: updatedNovel });
    } catch (error) {
        console.error("🔥 Chapter Upload Error:", error);
        res.status(500).json({ error: 'Chapter save nahi ho saka!', details: error.message });
    }
});
// 📊 6. ANALYTICS ROUTE: Total Views aur User counts nikalne ke liye
router.get('/admin/analytics', async (req, res) => {
    try {
        const novels = await Novel.find();
        
        // Saare novels ke views ko plus (+) karne ki logic
        let totalViews = 0;
        novels.forEach(n => {
            totalViews += (n.views || 0);
        });

        // Live Analytics Package
        res.status(200).json({
            totalNovels: novels.length,
            totalViews: totalViews,
            registeredUsers: 148, // Mock Data (Jab aap user signup banayenge ye dynamic ho jayega)
            activeOnlineUsers: Math.floor(Math.random() * (25 - 5 + 1)) + 5 // Real-time simulation (5 se 25 users live)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 🔥 CRITICAL FIX: Router ko export karna zaroori hai taaki server.js crash na ho!
module.exports = router;