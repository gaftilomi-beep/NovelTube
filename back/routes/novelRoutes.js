const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');

const Novel = require('../models/Novel');

const router = express.Router();

// ============================================================
// CLOUDINARY
// ============================================================

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ============================================================
// MULTER MEMORY STORAGE
// ============================================================

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024 // 15MB
    }
});

// ============================================================
// CLOUDINARY UPLOAD HELPER (FIXED)
// ============================================================

function uploadToCloudinary(buffer, folder, resourceType = 'auto') {
    return new Promise((resolve, reject) => {
        const options = {
            folder: folder,
            resource_type: resourceType
        };

        const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) {
                console.error('❌ Cloudinary Stream Error:', error);
                return reject(error);
            }
            resolve(result);
        });

        uploadStream.end(buffer);
    });
}

// ============================================================
// CREATE NOVEL
// ============================================================

router.post(
    '/',
    upload.fields([
        { name: 'coverImage', maxCount: 1 },
        { name: 'mainPdf', maxCount: 1 },
        { name: 'chapterFiles', maxCount: 50 }
    ]),
    async (req, res) => {
        try {
            console.log('📥 CREATE NOVEL REQUEST');

            const {
                title,
                author,
                description,
                status,
                hasChapters,
                chapterTitles,
                category,
                contentType
            } = req.body;

            if (!title || !title.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'Novel title lazmi hai.'
                });
            }

            // Cover Image Upload
            let coverImageUrl = '';
            if (req.files && req.files.coverImage && req.files.coverImage.length) {
                const file = req.files.coverImage[0];
                console.log('🖼️ Uploading cover...');
                const result = await uploadToCloudinary(file.buffer, 'noveltube/covers', 'image');
                coverImageUrl = result.secure_url;
            }

            const chaptersEnabled = hasChapters === 'true' || hasChapters === true;

            // Main PDF Upload
            let mainPdfUrl = '';
            if (!chaptersEnabled && req.files && req.files.mainPdf && req.files.mainPdf.length) {
                const file = req.files.mainPdf[0];
                console.log('📄 Uploading main PDF...');
                const result = await uploadToCloudinary(file.buffer, 'noveltube/pdfs', 'raw');
                mainPdfUrl = result.secure_url;
            }

            // Multiple Chapters Upload
            const finalChapters = [];
            if (chaptersEnabled && req.files && req.files.chapterFiles) {
                const titlesArray = Array.isArray(chapterTitles)
                    ? chapterTitles
                    : chapterTitles ? [chapterTitles] : [];

                for (let i = 0; i < req.files.chapterFiles.length; i++) {
                    const file = req.files.chapterFiles[i];
                    console.log(`📚 Uploading Chapter ${i + 1}...`);
                    const result = await uploadToCloudinary(file.buffer, 'noveltube/chapters', 'raw');
                    finalChapters.push({
                        chapterTitle: titlesArray[i] || `Chapter ${i + 1}`,
                        chapterPdf: result.secure_url
                    });
                }
            }

            // Save to DB
            const newNovel = new Novel({
                title: title.trim(),
                author: author && author.trim() ? author.trim() : 'Unknown Writer',
                description: description || '',
                status: status || 'Ongoing',
                category: category && category.trim() ? category.trim() : 'Newly Uploaded',
                contentType: contentType || 'novel',
                hasChapters: chaptersEnabled,
                coverImage: coverImageUrl,
                mainPdf: chaptersEnabled ? '' : mainPdfUrl,
                chapters: finalChapters,
                views: 0
            });

            await newNovel.save();

            console.log('✅ Novel saved:', newNovel._id.toString());
            return res.status(201).json({
                success: true,
                message: '🎉 Novel successfully publish ho gaya!',
                data: newNovel
            });

        } catch (error) {
            console.error('🔥 CREATE NOVEL ERROR:', error);
            return res.status(500).json({
                success: false,
                error: 'Novel save nahi ho saka.',
                details: error.message
            });
        }
    }
);

// ============================================================
// GET ALL NOVELS
// ============================================================

router.get('/', async (req, res) => {
    try {
        const novels = await Novel.find().sort({ createdAt: -1 });
        return res.status(200).json(novels);
    } catch (error) {
        console.error('🔥 GET NOVELS ERROR:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// GET CATEGORIES
// ============================================================

router.get('/categories', async (req, res) => {
    try {
        const categories = await Novel.distinct('category');
        return res.status(200).json(categories);
    } catch (error) {
        console.error('🔥 CATEGORIES ERROR:', error);
        return res.status(500).json({
            success: false,
            error: 'Categories load nahi ho sakeen!'
        });
    }
});

// ============================================================
// GET SINGLE NOVEL + VIEW INCREMENT
// ============================================================

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid novel ID.'
            });
        }

        const novel = await Novel.findByIdAndUpdate(
            id,
            { $inc: { views: 1 } },
            { new: true }
        );

        if (!novel) {
            return res.status(404).json({
                success: false,
                error: 'Novel nahi mila!'
            });
        }

        return res.status(200).json(novel);

    } catch (error) {
        console.error('🔥 SINGLE NOVEL ERROR:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// ADD SINGLE CHAPTER
// ============================================================

router.post(
    '/:id/add-chapter',
    upload.single('chapterFile'),
    async (req, res) => {
        console.log('\n==========================================');
        console.log('📚 ADD CHAPTER REQUEST');
        console.log('Novel ID:', req.params.id);
        console.log('Chapter Title:', req.body.chapterTitle);
        console.log('File:', req.file ? req.file.originalname : 'NO FILE');
        console.log('==========================================\n');

        try {
            const novelId = req.params.id;

            if (!mongoose.Types.ObjectId.isValid(novelId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid novel ID.'
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'PDF file lazmi upload karein!'
                });
            }

            if (req.file.mimetype !== 'application/pdf') {
                return res.status(400).json({
                    success: false,
                    error: 'Sirf PDF file upload karein!'
                });
            }

            const novel = await Novel.findById(novelId);
            if (!novel) {
                return res.status(404).json({
                    success: false,
                    error: 'Novel nahi mila!'
                });
            }

            const chapterTitle = req.body.chapterTitle && req.body.chapterTitle.trim()
                ? req.body.chapterTitle.trim()
                : `Chapter ${(novel.chapters?.length || 0) + 1}`;

            console.log('☁️ Uploading PDF to Cloudinary...');

            const result = await uploadToCloudinary(
                req.file.buffer,
                'noveltube/chapters',
                'raw'
            );

            if (!result || !result.secure_url) {
                throw new Error('Cloudinary ne PDF URL return nahi kiya.');
            }

            console.log('✅ Cloudinary upload successful');
            console.log('PDF URL:', result.secure_url);

            const updatedNovel = await Novel.findByIdAndUpdate(
                novelId,
                {
                    $push: {
                        chapters: {
                            chapterTitle: chapterTitle,
                            chapterPdf: result.secure_url
                        }
                    }
                },
                { new: true, runValidators: true }
            );

            if (!updatedNovel) {
                return res.status(404).json({
                    success: false,
                    error: 'Novel update nahi ho saka.'
                });
            }

            console.log('🎉 CHAPTER SAVED SUCCESSFULLY');
            return res.status(200).json({
                success: true,
                message: '🎉 Chapter kamyabi se add ho gaya!',
                data: updatedNovel
            });

        } catch (error) {
            console.error('\n🔥 ADD CHAPTER ERROR:', error, '\n');
            return res.status(500).json({
                success: false,
                error: 'Server error! Chapter save nahi ho saka.',
                details: error.message
            });
        }
    }
);

// ============================================================
// DELETE CHAPTER
// ============================================================

router.delete('/:novelId/chapters/:chapterId', async (req, res) => {
    try {
        const { novelId, chapterId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(novelId) || !mongoose.Types.ObjectId.isValid(chapterId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid ID provided.'
            });
        }

        const updatedNovel = await Novel.findByIdAndUpdate(
            novelId,
            { $pull: { chapters: { _id: chapterId } } },
            { new: true }
        );

        if (!updatedNovel) {
            return res.status(404).json({
                success: false,
                error: 'Novel nahi mila!'
            });
        }

        return res.status(200).json({
            success: true,
            message: '🎉 Chapter kamyabi se delete ho gaya!',
            data: updatedNovel
        });

    } catch (error) {
        console.error('🔥 DELETE CHAPTER ERROR:', error);
        return res.status(500).json({
            success: false,
            error: 'Chapter delete nahi ho saka.',
            details: error.message
        });
    }
});

// ============================================================
// DELETE NOVEL
// ============================================================

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid novel ID.'
            });
        }

        const deletedNovel = await Novel.findByIdAndDelete(id);

        if (!deletedNovel) {
            return res.status(404).json({
                success: false,
                error: 'Novel nahi mila!'
            });
        }

        return res.status(200).json({
            success: true,
            message: '🎉 Novel database se delete ho gaya!'
        });

    } catch (error) {
        console.error('🔥 DELETE NOVEL ERROR:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// MULTER ERROR MIDDLEWARE
// ============================================================

router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        console.error('🔥 MULTER ERROR:', error);
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File maximum 15MB ki ho sakti hai.'
            });
        }
        return res.status(400).json({
            success: false,
            error: `File upload error: ${error.message}`
        });
    }
    next(error);
});

module.exports = router;