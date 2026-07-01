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
// 📥 1. POST ROUTE: Novel aur Chapters upload karne ke liye (FIXED CATEGORY ISSUE)
router.post('/', upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'mainPdf', maxCount: 1 }
]), async (req, res) => {
    try {
        const { title, author, description, status, category, hasChapters } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Novel ka Title lazmi hai!' });
        }

        // 🖼️ Cloudinary file paths variables
        let coverImageUrl = '';
        let mainPdfUrl = '';

        // Cover Image Cloudinary par upload karein
        if (req.files && req.files.coverImage) {
            const coverResult = await cloudinary.uploader.upload(req.files.coverImage[0].path, {
                folder: 'noveltube/covers'
            });
            coverImageUrl = coverResult.secure_url;
            fs.unlinkSync(req.files.coverImage[0].path); // Temp file clear
        }

        // Main PDF Cloudinary par upload karein (Agar hasChapters false hai)
        if (req.files && req.files.mainPdf && (hasChapters === 'false' || hasChapters === false)) {
            const pdfResult = await cloudinary.uploader.upload(req.files.mainPdf[0].path, {
                folder: 'noveltube/pdfs',
                resource_type: 'raw' // PDF ke liye raw lazmi hai
            });
            mainPdfUrl = pdfResult.secure_url;
            fs.unlinkSync(req.files.mainPdf[0].path); // Temp file clear
        }

        // ⚡ Naya Novel insert karein bina kisi category validation clash ke!
        const newNovel = new Novel({
            title,
            author: author || 'Unknown Writer',
            description,
            coverImage: coverImageUrl,
            status: status || 'Ongoing',
            category: category ? category.trim() : 'Newly Uploaded',
            hasChapters: hasChapters === 'true' || hasChapters === true,
            mainPdf: hasChapters === 'false' || hasChapters === false ? mainPdfUrl : undefined,
            views: 0
        });

        await newNovel.save();

        res.status(201).json({ 
            success: true, 
            message: '🎉 Novel kamyabi se upload ho gaya!', 
            data: newNovel 
        });

    } catch (error) {
        console.error("🔥 Upload Error:", error);
        res.status(500).json({ error: 'Novel save nahi ho saka!', details: error.message });
    }
});
// 🔍 GET ALL CATEGORIES: Saari mojooda categories frontend ko bhejne ke liye
router.get('/categories', async (req, res) => {
    try {
        // Distinct se database mein mojood saari unique categories nikal aayengi
        const categories = await Novel.distinct('category');
        return res.status(200).json(categories);
    } catch (error) {
        console.error("🔥 Categories Fetch Error:", error);
        return res.status(500).json({ error: 'Categories load nahi ho sakeen!' });
    }
});
module.exports = router;