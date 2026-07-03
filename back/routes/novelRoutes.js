const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2; 
const Novel = require('../models/Novel'); 

const router = express.Router();

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

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

// 🔥 FIXED MASTER POST ROUTE: Dono duplicate routes ko mix kar ke aik perfect route bana diya hy
router.post('/', upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'mainPdf', maxCount: 1 },
    { name: 'chapterFiles', maxCount: 50 }
]), async (req, res) => {
    try {
        const { title, author, description, status, hasChapters, chapterTitles, category } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Novel ka Title lazmi hai!' });
        }

        // A. Cover Image Upload
        let coverImageUrl = '';
        if (req.files && req.files['coverImage']) {
            const file = req.files['coverImage'][0];
            const result = await cloudinary.uploader.upload(file.path, {
                folder: 'noveltube/covers',
                resource_type: 'image'
            });
            coverImageUrl = result.secure_url; 
            fs.unlinkSync(file.path); 
        }

        // B. Main Single PDF Upload
        let mainPdfUrl = '';
        if ((hasChapters === 'false' || hasChapters === false) && req.files && req.files['mainPdf']) {
            const file = req.files['mainPdf'][0];
            const result = await cloudinary.uploader.upload(file.path, {
                folder: 'noveltube/pdfs',
                resource_type: 'raw' 
            });
            mainPdfUrl = result.secure_url;
            fs.unlinkSync(file.path); 
        }

        // C. Multiple Chapters Upload
        let finalChapters = [];
        if ((hasChapters === 'true' || hasChapters === true) && req.files && req.files['chapterFiles']) {
            const titlesArray = Array.isArray(chapterTitles) ? chapterTitles : [chapterTitles];
            
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
                
                fs.unlinkSync(file.path); 
            }
        }

        // Save to MongoDB
        const newNovel = new Novel({
            title,
            author: author || 'Unknown Writer',
            description,
            status: status || 'Ongoing',
            category: category ? category.trim() : 'Newly Uploaded',
            hasChapters: hasChapters === 'true' || hasChapters === true,
            coverImage: coverImageUrl,
            mainPdf: (hasChapters === 'true' || hasChapters === true) ? '' : mainPdfUrl,
            chapters: finalChapters,
            views: 0
        });

        await newNovel.save();
        res.status(201).json({ success: true, message: '🎉 Novel kamyabi se publish ho gaya!', data: newNovel });

    } catch (error) {
        console.error("🔥 Server Error:", error);
        res.status(500).json({ error: 'Database ya Cloudinary par save nahi ho saka!', details: error.message });
    }
});

// GET ALL NOVELS
router.get('/', async (req, res) => {
    try {
        const novels = await Novel.find().sort({ _id: -1 });
        res.status(200).json(novels);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET SINGLE NOVEL
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

// DELETE ROUTE
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

// GET ALL CATEGORIES
router.get('/categories', async (req, res) => {
    try {
        const categories = await Novel.distinct('category');
        return res.status(200).json(categories);
    } catch (error) {
        console.error("🔥 Categories Fetch Error:", error);
        return res.status(500).json({ error: 'Categories load nahi ho sakeen!' });
    }
});

module.exports = router;