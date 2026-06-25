const Chapter = require('../models/Chapter');

// 1. Naya Chapter Add Karne Ke Liye (Admin Feature)
const createChapter = async (req, res) => {
    try {
        const { novelId, chapterNumber, title, content } = req.body;

        const newChapter = new Chapter({
            novelId,
            chapterNumber,
            title,
            content
        });

        const savedChapter = await newChapter.save();
        res.status(201).json({ success: true, message: "Chapter successfully added!", data: savedChapter });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. Kisi Novel Ke Saare Chapters Ki List Get Karne Ke Liye (Index List)
const getChaptersByNovel = async (req, res) => {
    try {
        const chapters = await Chapter.find({ novelId: req.params.novelId }).select('chapterNumber title createdAt').sort({ chapterNumber: 1 });
        res.status(200).json({ success: true, data: chapters });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Aik Specific Chapter Ka Poora Content Parhne Ke Liye (Reading Page)
const getChapterDetails = async (req, res) => {
    try {
        const { novelId, chapterNumber } = req.params;
        const chapter = await Chapter.findOne({ novelId, chapterNumber });
        
        if (!chapter) {
            return res.status(404).json({ success: false, message: "Chapter nahi mila!" });
        }
        res.status(200).json({ success: true, data: chapter });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { createChapter, getChaptersByNovel, getChapterDetails };