const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const Novel = require('../models/Novel');

const router = express.Router();

// ============================================================
// ☁️ CLOUDINARY CONFIGURATION
// ============================================================

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ============================================================
// 📁 MULTER MEMORY STORAGE
// ============================================================

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 15 * 1024 * 1024 // 15MB
    }
});

// ============================================================
// ☁️ CLOUDINARY UPLOAD HELPER
// ============================================================

const uploadToCloudinary = (
    fileBuffer,
    folder,
    resourceType = 'auto'
) => {

    return new Promise((resolve, reject) => {

        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: resourceType
            },
            (error, result) => {

                if (error) {
                    return reject(error);
                }

                resolve(result);
            }
        );

        stream.end(fileBuffer);
    });
};

// ============================================================
// 🟢 1. CREATE / UPLOAD NOVEL
// ============================================================

router.post(
    '/',
    upload.fields([
        {
            name: 'coverImage',
            maxCount: 1
        },
        {
            name: 'mainPdf',
            maxCount: 1
        },
        {
            name: 'chapterFiles',
            maxCount: 50
        }
    ]),
    async (req, res) => {

        try {

            console.log('📥 New novel upload received');

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

            // ------------------------------------------------
            // BASIC VALIDATION
            // ------------------------------------------------

            if (!title || !title.trim()) {

                return res.status(400).json({
                    success: false,
                    error: 'Novel title lazmi hai.'
                });
            }

            // ------------------------------------------------
            // COVER IMAGE
            // ------------------------------------------------

            let coverImageUrl = '';

            if (
                req.files &&
                req.files.coverImage &&
                req.files.coverImage.length > 0
            ) {

                const file = req.files.coverImage[0];

                console.log(
                    '🖼️ Uploading cover to Cloudinary...'
                );

                const result =
                    await uploadToCloudinary(
                        file.buffer,
                        'noveltube/covers',
                        'image'
                    );

                coverImageUrl = result.secure_url;
            }

            // ------------------------------------------------
            // MAIN PDF
            // ------------------------------------------------

            let mainPdfUrl = '';

            if (
                hasChapters === 'false' &&
                req.files &&
                req.files.mainPdf &&
                req.files.mainPdf.length > 0
            ) {

                const file = req.files.mainPdf[0];

                console.log(
                    '📄 Uploading main PDF to Cloudinary...'
                );

                const result =
                    await uploadToCloudinary(
                        file.buffer,
                        'noveltube/pdfs',
                        'raw'
                    );

                mainPdfUrl = result.secure_url;
            }

            // ------------------------------------------------
            // MULTIPLE CHAPTERS
            // ------------------------------------------------

            const finalChapters = [];

            if (
                hasChapters === 'true' &&
                req.files &&
                req.files.chapterFiles
            ) {

                const titlesArray =
                    Array.isArray(chapterTitles)
                        ? chapterTitles
                        : chapterTitles
                            ? [chapterTitles]
                            : [];

                for (
                    let index = 0;
                    index < req.files.chapterFiles.length;
                    index++
                ) {

                    const file =
                        req.files.chapterFiles[index];

                    console.log(
                        `📚 Uploading Chapter ${index + 1}...`
                    );

                    const result =
                        await uploadToCloudinary(
                            file.buffer,
                            'noveltube/chapters',
                            'raw'
                        );

                    const title =
                        titlesArray[index] ||
                        `Chapter ${index + 1}`;

                    finalChapters.push({

                        // Dashboard ke saath consistent
                        chapterTitle: title,

                        chapterPdf:
                            result.secure_url
                    });
                }
            }

            // ------------------------------------------------
            // SAVE NOVEL
            // ------------------------------------------------

            const newNovel = new Novel({

                title: title.trim(),

                author:
                    author && author.trim()
                        ? author.trim()
                        : 'Unknown Writer',

                description:
                    description || '',

                status:
                    status || 'Ongoing',

                category:
                    category && category.trim()
                        ? category.trim()
                        : 'Newly Uploaded',

                contentType:
                    contentType || 'novel',

                hasChapters:
                    hasChapters === 'true',

                coverImage:
                    coverImageUrl,

                mainPdf:
                    hasChapters === 'true'
                        ? ''
                        : mainPdfUrl,

                chapters:
                    finalChapters,

                views: 0
            });

            await newNovel.save();

            console.log(
                '✅ Novel saved successfully:',
                newNovel._id
            );

            return res.status(201).json({

                success: true,

                message:
                    '🎉 Novel Cloudinary aur MongoDB par successfully publish ho gaya!',

                data: newNovel
            });

        } catch (error) {

            console.error(
                '🔥 Upload Novel Error:',
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    'Database ya Cloudinary par save nahi ho saka!',

                details:
                    error.message
            });
        }
    }
);

// ============================================================
// 🟢 2. GET ALL NOVELS
// ============================================================

router.get(
    '/',
    async (req, res) => {

        try {

            const novels =
                await Novel
                    .find()
                    .sort({
                        _id: -1
                    });

            return res.status(200).json(
                novels
            );

        } catch (error) {

            console.error(
                '🔥 Get Novels Error:',
                error
            );

            return res.status(500).json({
                error: error.message
            });
        }
    }
);

// ============================================================
// 🟢 3. GET CATEGORIES
// ============================================================

router.get(
    '/categories',
    async (req, res) => {

        try {

            const categories =
                await Novel.distinct(
                    'category'
                );

            return res.status(200).json(
                categories
            );

        } catch (error) {

            console.error(
                '🔥 Categories Error:',
                error
            );

            return res.status(500).json({
                error:
                    'Categories load nahi ho sakeen!'
            });
        }
    }
);

// ============================================================
// 🟢 4. GET SINGLE NOVEL + VIEW COUNT
// ============================================================

router.get(
    '/:id',
    async (req, res) => {

        try {

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {

                return res.status(400).json({
                    error: 'Invalid novel ID.'
                });
            }

            const novel =
                await Novel.findByIdAndUpdate(
                    req.params.id,

                    {
                        $inc: {
                            views: 1
                        }
                    },

                    {
                        new: true
                    }
                );

            if (!novel) {

                return res.status(404).json({
                    error: 'Novel nahi mila!'
                });
            }

            return res.status(200).json(
                novel
            );

        } catch (error) {

            console.error(
                '🔥 Single Novel Error:',
                error
            );

            return res.status(500).json({
                error: error.message
            });
        }
    }
);

// ============================================================
// 🟢 5. DELETE NOVEL
// ============================================================

router.delete(
    '/:id',
    async (req, res) => {

        try {

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {

                return res.status(400).json({
                    error: 'Invalid novel ID.'
                });
            }

            const deletedNovel =
                await Novel.findByIdAndDelete(
                    req.params.id
                );

            if (!deletedNovel) {

                return res.status(404).json({
                    error: 'Novel nahi mila!'
                });
            }

            return res.status(200).json({

                success: true,

                message:
                    '🎉 Novel database se delete ho gaya!'
            });

        } catch (error) {

            console.error(
                '🔥 Delete Novel Error:',
                error
            );

            return res.status(500).json({
                error: error.message
            });
        }
    }
);

// ============================================================
// 🔥 6. ADD SINGLE CHAPTER / EPISODE
// ============================================================

router.post(
    '/:id/add-chapter',
    upload.single('chapterFile'),
    async (req, res) => {

        console.log(
            '================================================'
        );

        console.log(
            '📚 ADD CHAPTER REQUEST RECEIVED'
        );

        console.log(
            'Novel ID:',
            req.params.id
        );

        console.log(
            'Chapter Title:',
            req.body.chapterTitle
        );

        console.log(
            'File:',
            req.file
                ? req.file.originalname
                : 'NO FILE'
        );

        console.log(
            '================================================'
        );

        try {

            // ------------------------------------------------
            // CHECK NOVEL ID
            // ------------------------------------------------

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        'Invalid novel ID.'
                });
            }

            // ------------------------------------------------
            // CHECK FILE
            // ------------------------------------------------

            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    error:
                        'PDF file lazmi upload karein!'
                });
            }

            // ------------------------------------------------
            // CHECK FILE TYPE
            // ------------------------------------------------

            const isPdf =
                req.file.mimetype ===
                'application/pdf';

            if (!isPdf) {

                return res.status(400).json({

                    success: false,

                    error:
                        'Sirf PDF file upload karein!'
                });
            }

            // ------------------------------------------------
            // CHECK NOVEL
            // ------------------------------------------------

            const existingNovel =
                await Novel.findById(
                    req.params.id
                );

            if (!existingNovel) {

                return res.status(404).json({

                    success: false,

                    error:
                        'Novel nahi mila!'
                });
            }

            console.log(
                '✅ Novel found:',
                existingNovel.title
            );

            // ------------------------------------------------
            // CHAPTER TITLE
            // ------------------------------------------------

            const chapterTitle =
                req.body.chapterTitle &&
                req.body.chapterTitle.trim()
                    ? req.body.chapterTitle.trim()
                    : 'Untitled Episode';

            // ------------------------------------------------
            // CLOUDINARY UPLOAD
            // ------------------------------------------------

            console.log(
                '☁️ Uploading PDF to Cloudinary...'
            );

            const result =
                await uploadToCloudinary(
                    req.file.buffer,
                    'noveltube/chapters',
                    'raw'
                );

            console.log(
                '✅ Cloudinary upload successful'
            );

            console.log(
                'PDF URL:',
                result.secure_url
            );

            // ------------------------------------------------
            // ADD CHAPTER TO MONGODB
            // ------------------------------------------------

            const updatedNovel =
                await Novel.findByIdAndUpdate(

                    req.params.id,

                    {
                        $push: {

                            chapters: {

                                chapterTitle:
                                    chapterTitle,

                                chapterPdf:
                                    result.secure_url
                            }
                        }
                    },

                    {
                        new: true,
                        runValidators: true
                    }
                );

            if (!updatedNovel) {

                return res.status(404).json({

                    success: false,

                    error:
                        'Novel update nahi ho saka.'
                });
            }

            console.log(
                '🎉 CHAPTER SUCCESSFULLY SAVED!'
            );

            console.log(
                'Total Chapters:',
                updatedNovel.chapters
                    ? updatedNovel.chapters.length
                    : 0
            );

            return res.status(200).json({

                success: true,

                message:
                    '🎉 Chapter kamyabi se add ho gaya!',

                data: updatedNovel
            });

        } catch (error) {

            console.error(
                '🔥🔥 ADD CHAPTER ERROR 🔥🔥'
            );

            console.error(
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    'Server error! Chapter save nahi ho saka.',

                details:
                    error.message
            });
        }
    }
);

// ============================================================
// 🟢 7. DELETE CHAPTER
// ============================================================

router.delete(
    '/:novelId/chapters/:chapterId',
    async (req, res) => {

        try {

            const {
                novelId,
                chapterId
            } = req.params;

            if (
                !mongoose.Types.ObjectId.isValid(
                    novelId
                )
            ) {

                return res.status(400).json({
                    message:
                        'Invalid novel ID.'
                });
            }

            const updatedNovel =
                await Novel.findByIdAndUpdate(

                    novelId,

                    {
                        $pull: {
                            chapters: {
                                _id: chapterId
                            }
                        }
                    },

                    {
                        new: true
                    }
                );

            if (!updatedNovel) {

                return res.status(404).json({

                    message:
                        'Novel ya chapter nahi mila!'
                });
            }

            return res.status(200).json({

                success: true,

                message:
                    '🎉 Chapter kamyabi se delete ho gaya!',

                data: updatedNovel
            });

        } catch (error) {

            console.error(
                '🔥 Delete Chapter Error:',
                error
            );

            return res.status(500).json({

                message:
                    'Server error! Chapter delete nahi ho saka.',

                details:
                    error.message
            });
        }
    }
);

// ============================================================
// ERROR HANDLER FOR MULTER
// ============================================================

router.use(
    (error, req, res, next) => {

        if (
            error instanceof multer.MulterError
        ) {

            console.error(
                '🔥 Multer Error:',
                error
            );

            if (
                error.code ===
                'LIMIT_FILE_SIZE'
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        'PDF maximum 15MB ka ho sakta hai.'
                });
            }

            return res.status(400).json({

                success: false,

                error:
                    `File upload error: ${error.message}`
            });
        }

        next(error);
    }
);

module.exports = router;