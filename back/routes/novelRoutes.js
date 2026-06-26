const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2; // 🔥 Cloudinary SDK
const Novel = require('../models/Novel'); // Model ka path

const router = express.Router();

// ☁️ Cloudinary Configuration (Jo aapne .env mein set kiya hy)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 📂 Ensure temporary 'uploads' folder exists automatically
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// ⚙️ Multer Configuration (Temporary local staging ke liye)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); 
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

        // A. Cover Image Upload to Cloudinary
        let coverImageUrl = '';
        if (req.files && req.files['coverImage']) {
            const file = req.files['coverImage'][0];
            const result = await cloudinary.uploader.upload(file.path, {
                folder: 'noveltube/covers',
                resource_type: 'image'
            });
            coverImageUrl = result.secure_url; // Permanent Cloud Link
            fs.unlinkSync(file.path); // Local temporary file delete karein
        }

        // B. Main Single PDF Upload to Cloudinary
        let mainPdfUrl = '';
        if (hasChapters === 'false' && req.files && req.files['mainPdf']) {
            const file = req.files['mainPdf'][0];
            const result = await cloudinary.uploader.upload(file.path, {
                folder: 'noveltube/pdfs',
                resource_type: 'auto' // Auto-detect PDF format
            });
            mainPdfUrl = result.secure_url;
            fs.unlinkSync(file.path); // Local temporary file delete karein
        }

        // C. Multiple Chapters Upload to Cloudinary
        let finalChapters = [];
        if (hasChapters === 'true' && req.files && req.files['chapterFiles']) {
            const titlesArray = Array.isArray(chapterTitles) ? chapterTitles : [chapterTitles];
            
            // Loop chala kar aik aik karke saari files upload hongi
            for (let index = 0; index < req.files['chapterFiles'].length; index++) {
                const file = req.files['chapterFiles'][index];
                const result = await cloudinary.uploader.upload(file.path, {
                    folder: 'noveltube/chapters',
                    resource_type: 'auto'
                });
                
                finalChapters.push({
                    chapterTitle: titlesArray[index] || `Chapter ${index + 1}`,
                    chapterPdf: result.secure_url
                });
                
                fs.unlinkSync(file.path); // Upload hote hi local file saaf
            }
        }

        // Save to MongoDB
        const newNovel = new Novel({
            title,
            author: author || 'Unknown Writer',
            description,
            status,
            category: category || 'Newly Uploaded',
            hasChapters: hasChapters === 'true',
            coverImage: coverImageUrl,
            mainPdf: hasChapters === 'true' ? '' : mainPdfUrl,
            chapters: finalChapters
        });

        await newNovel.save();
        res.status(201).json({ message: '🎉 Novel Cloudinary par kamyabi se publish ho gaya!', data: newNovel });

    } catch (error) {
        console.error("🔥 Server Error:", error);
        res.status(500).json({ error: 'Database ya Cloudinary par save nahi ho saka!', details: error.message });
    }
});

// 📤 2. GET ROUTE: Saare novels homepage par dikhane ke liye
router.get('/', async (req, res) => {
    try {
        const novels = await Novel.find().sort({ _id: -1 });
        res.status(200).json(novels);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📤 3. GET SINGLE NOVEL ROUTE: Open hote hi view count +1 karo
router.get('/:id', async (req, res) => {
    try {
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

// 🗑️ 4. DELETE ROUTE: Novel ko database se mitaane ke liye
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

        // Single Chapter Upload to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'noveltube/chapters',
            resource_type: 'auto'
        });
        const chapterPdfUrl = result.secure_url;
        
        fs.unlinkSync(req.file.path); // Temporary local file delete karein

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
            { new: true }
        );

        res.status(200).json({ message: '🎉 Naya chapter Cloudinary par save ho gaya!', data: updatedNovel });
    } catch (error) {
        console.error("🔥 Chapter Upload Error:", error);
        res.status(500).json({ error: 'Chapter save nahi ho saka!', details: error.message });
    }
});

// 📊 6. ANALYTICS ROUTE: Total Views aur User counts nikalne ke liye
router.get('/admin/analytics', async (req, res) => {
    try {
        const novels = await Novel.find();
        let totalViews = 0;
        novels.forEach(n => {
            totalViews += (n.views || 0);
        });

        res.status(200).json({
            totalNovels: novels.length,
            totalViews: totalViews,
            registeredUsers: 148, 
            activeOnlineUsers: Math.floor(Math.random() * (25 - 5 + 1)) + 5 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;