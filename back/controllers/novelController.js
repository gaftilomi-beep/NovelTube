const Novel = require('../models/Novel');

// 1. Naya Novel Add Karne Ke Liye (Admin Post Feature)
const createNovel = async (req, res) => {
    try {
        const { title, description, coverImage, author, genre, status, hasChapters } = req.body;
        
        const newNovel = new Novel({
            title,
            description,
            coverImage,
            author,
            genre,
            status,
            hasChapters // 🔥 ON/OFF feature shamil hai
        });

        const savedNovel = await newNovel.save();
        res.status(201).json({ success: true, message: "Novel successfully created!", data: savedNovel });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. Saare Novels Get Karne Ke Liye (Home Page par dikhane ke liye)
const getAllNovels = async (req, res) => {
    try {
        const novels = await Novel.find().sort({ createdAt: -1 }); 
        res.status(200).json({ success: true, data: novels });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Kisi Aik Specific Novel Ki Detail Get Karne Ke Liye (Novel Detail Page)
const getNovelById = async (req, res) => {
    try {
        const novel = await Novel.findById(req.params.id);
        if (!novel) {
            return res.status(404).json({ success: false, message: "Novel nahi mila!" });
        }
        res.status(200).json({ success: true, data: novel });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 🔥 VIP LINE: Yeh sab ko export karna zaroori hai taaki routes ko mil sakein!
module.exports = { createNovel, getAllNovels, getNovelById };