// ✅ NOVEL UPLOAD YA CREATE WALE CONTROLLER FUNCTION KO IS TARAH UPDATE KAREIN:
const Novel = require('../models/Novel');

const createNovel = async (req, res) => {
    try {
        const { title, author, description, status, category, hasChapters } = req.body;

        // 🚨 PURANI GALTI JO APNE KI THI:
        // const existingCategory = await Novel.findOne({ category }); 
        // if (existingCategory) return res.status(400).json({ error: "Category already exists!" });
        // 👆 Agar yeh lines ya is jaisa koi check laga hai, TOH USKO DELETE KAR DEIN!

        // 🖼️ Files path check karne ke liye safe logic
        const coverImage = req.files && req.files.coverImage ? `/uploads/${req.files.coverImage[0].filename}` : '';
        const mainPdf = req.files && req.files.mainPdf ? `/uploads/${req.files.mainPdf[0].filename}` : '';

        // ⚡ Naya Novel banayein bina kisi category validation ke clash ke
        const newNovel = new Novel({
            title,
            author: author || 'Unknown Writer',
            description,
            coverImage,
            status: status || 'Ongoing',
            // .trim() lagane se extra spaces ka masla hal ho jata hai
            category: category ? category.trim() : 'Newly Uploaded', 
            hasChapters: hasChapters === 'true' || hasChapters === true,
            mainPdf: hasChapters === 'false' || hasChapters === false ? mainPdf : undefined,
            views: 0 // Humne views tracker bhi yahan initialize kar diya
        });

        await newNovel.save();
        
        return res.status(201).json({ 
            success: true, 
            message: "🎉 Novel kamyabi se upload ho gaya!", 
            data: newNovel 
        });

    } catch (error) {
        console.error("Upload error details:", error);
        return res.status(500).json({ 
            success: false, 
            error: "Novel insert nahi ho saka ya database ka koi masla hai!" 
        });
    }
};

// Baaki exports check kar lein ke aapka setup kaisa hai
module.exports = { createNovel };