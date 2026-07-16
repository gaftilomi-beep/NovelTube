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
// 🔥 NAYA FEATURE: Specific Chapter Delete Karne Ke Liye
const deleteChapter = async (req, res) => {
    try {
        const { chapterId } = req.params;
        
        // 1. Chapter ko find aur delete karein
        const deletedChapter = await Chapter.findByIdAndDelete(chapterId);
        if (!deletedChapter) {
            return res.status(404).json({ success: false, message: "Chapter nahi mila!" });
        }

        // 2. Novel model ko import kar ke, uske chapters array se bhi is ID ko nikaal (pull) dein
        const Novel = mongoose.model('Novel');
        await Novel.findByIdAndUpdate(
            deletedChapter.novelId, // Schema ke mutabiq 'novelId' hi sahi field name hai
            { $pull: { chapters: chapterId } }
        );

        res.status(200).json({ success: true, message: "Chapter successfully delete ho gaya!" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { 
    createChapter, 
    getChaptersByNovel, 
    getChapterDetails, 
    deleteChapter // <-- Yeh yahan add karna lazmi hai
};