const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const Novel = require('../models/Novel');

const router = express.Router();

// ☁️ Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ⚡ Multer Memory Storage (Local Disk Ki Zaroorat Nahi Padegi)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB file limit
});

// 🛠️ Buffer se Direct Cloudinary Upload karne ka Utility Function
const uploadToCloudinary = (fileBuffer, folder, resourceType = 'auto') => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: resourceType },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        stream.end(fileBuffer);
    });
};

// -------------------------------------------------------------
// 1. POST ROUTE: Naya Novel Upload Karne Ke Liye
// -------------------------------------------------------------
router.post('/', upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'mainPdf', maxCount: 1 },
    { name: 'chapterFiles', maxCount: 50 }
]), async (req, res) => {
    try {
        const { title, author, description, status, hasChapters, chapterTitles, category } = req.body;

        // A. Cover Image Upload
        let coverImageUrl = '';
        if (req.files && req.files['coverImage']) {
            const file = req.files['coverImage'][0];
            const result = await uploadToCloudinary(file.buffer, 'noveltube/covers', 'image');
            coverImageUrl = result.secure_url;
        }

        // B. Main Single PDF Upload
        let mainPdfUrl = '';
        if (hasChapters === 'false' && req.files && req.files['mainPdf']) {
            const file = req.files['mainPdf'][0];
            const result = await uploadToCloudinary(file.buffer, 'noveltube/pdfs', 'raw');
            mainPdfUrl = result.secure_url;
        }

        // C. Multiple Chapters Upload
        let finalChapters = [];
        if (hasChapters === 'true' && req.files && req.files['chapterFiles']) {
            const titlesArray = Array.isArray(chapterTitles) ? chapterTitles : [chapterTitles];
            
            for (let index = 0; index < req.files['chapterFiles'].length; index++) {
                const file = req.files['chapterFiles'][index];
                const result = await uploadToCloudinary(file.buffer, 'noveltube/chapters', 'raw');
                
                finalChapters.push({
                    chapterTitle: titlesArray[index] || `Chapter ${index + 1}`,
                    chapterPdf: result.secure_url
                });
            }
        }

        // MongoDB Mein Save Karein
        const newNovel = new Novel({
            title,
            author: author || 'Unknown Writer',
            description,
            status: status || 'Ongoing',
            category: category ? category.trim() : 'Newly Uploaded',
            hasChapters: hasChapters === 'true',
            coverImage: coverImageUrl,
            mainPdf: hasChapters === 'true' ? '' : mainPdfUrl,
            chapters: finalChapters,
            views: 0
        });

        await newNovel.save();
        res.status(201).json({ 
            success: true, 
            message: '🎉 Novel Cloudinary par kamyabi se publish ho gaya!', 
            data: newNovel 
        });

    } catch (error) {
        console.error("🔥 Upload Novel Error:", error);
        res.status(500).json({ error: 'Database ya Cloudinary par save nahi ho saka!', details: error.message });
    }
});

// -------------------------------------------------------------
// 2. GET ROUTE: Saare Novels Fetch Karne Ke Liye
// -------------------------------------------------------------
router.get('/', async (req, res) => {
    try {
        const novels = await Novel.find().sort({ _id: -1 });
        res.status(200).json(novels);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// -------------------------------------------------------------
// 3. GET ALL CATEGORIES
// -------------------------------------------------------------
router.get('/categories', async (req, res) => {
    try {
        const categories = await Novel.distinct('category');
        return res.status(200).json(categories);
    } catch (error) {
        console.error("🔥 Categories Fetch Error:", error);
        return res.status(500).json({ error: 'Categories load nahi ho sakeen!' });
    }
});

// -------------------------------------------------------------
// 4. GET SINGLE NOVEL (+1 View Count)
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// 5. DELETE ROUTE: Novel Delete Karne Ke Liye
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// 6. ADD CHAPTER ROUTE (Single Chapter Add Karne Ke Liye)
// -------------------------------------------------------------
router.post('/:id/add-chapter', upload.single('chapterFile'), async (req, res) => {
    try {
        const { id } = req.params;
        const { chapterTitle } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'PDF file lazmi upload karein!' });
        }

        // Buffer se Direct Cloudinary Upload
        const result = await uploadToCloudinary(req.file.buffer, 'noveltube/chapters', 'raw');

        // Document Update
        const updatedNovel = await Novel.findByIdAndUpdate(
            id,
            {
                $push: {
                    chapters: {
                        chapterTitle: chapterTitle || 'Untitled Episode',
                        chapterPdf: result.secure_url
                    }
                }
            },
            { new: true }
        );

        if (!updatedNovel) {
            return res.status(404).json({ error: 'Novel nahi mila!' });
        }

        res.status(200).json({ 
            success: true, 
            message: '🎉 Chapter kamyabi se add ho gaya!', 
            data: updatedNovel 
        });

    } catch (error) {
        console.error("🔥 Add Chapter Error:", error);
        res.status(500).json({ error: 'Server error! Chapter save nahi ho saka.', details: error.message });
    }
});

// -------------------------------------------------------------
// 7. DELETE CHAPTER ROUTE
// -------------------------------------------------------------
router.delete('/:novelId/chapters/:chapterId', async (req, res) => {
    try {
        const { novelId, chapterId } = req.params;

        const updatedNovel = await Novel.findByIdAndUpdate(
            novelId,
            { $pull: { chapters: { _id: chapterId } } },
            { new: true }
        );

        if (!updatedNovel) {
            return res.status(404).json({ message: 'Novel ya chapter nahi mila!' });
        }

        res.status(200).json({ 
            success: true, 
            message: '🎉 Chapter kamyabi se delete ho gaya!',
            data: updatedNovel
        });
    } catch (error) {
        console.error("🔥 Delete Chapter Error:", error);
        res.status(500).json({ message: 'Server error! Chapter delete nahi ho saka.', details: error.message });
    }
});

module.exports = router;