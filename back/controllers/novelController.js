const Novel = require('../models/Novel');

// Helper function: Clean Slug banane ke liye
const createSlug = (text) => {
    if (!text) return `novel-${Date.now()}`;
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Special characters remove karein
        .replace(/[\s_-]+/g, '-')  // Spaces ko '-' se replace karein
        .replace(/^-+|-+$/g, '');   // Trim hyphens
};

const createNovel = async (req, res) => {
    try {
        const { title, author, description, status, category, hasChapters } = req.body;

        // 🖼️ Files path check karne ke liye safe logic
        const coverImage = req.files && req.files.coverImage ? `/uploads/${req.files.coverImage[0].filename}` : '';
        const mainPdf = req.files && req.files.mainPdf ? `/uploads/${req.files.mainPdf[0].filename}` : '';

        // 🔗 Slug Generate Karein
        let generatedSlug = createSlug(title);
        
        // Slug duplicate handling (agar same title ka novel pehle se ho)
        const existingSlug = await Novel.findOne({ slug: generatedSlug });
        if (existingSlug) {
            generatedSlug = `${generatedSlug}-${Date.now().toString().slice(-4)}`;
        }

        // ⚡ Naya Novel banayein
        const newNovel = new Novel({
            title,
            slug: generatedSlug,
            author: author || 'Unknown Writer',
            description,
            coverImage,
            status: status || 'Ongoing',
            category: category ? category.trim() : 'Newly Uploaded', 
            hasChapters: hasChapters === 'true' || hasChapters === true,
            mainPdf: hasChapters === 'false' || hasChapters === false ? mainPdf : undefined,
            views: 0
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

// Slug ke zariye Novel details fetch karne ke liye function
const getNovelBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const novel = await Novel.findOne({ slug: slug.toLowerCase() });

        if (!novel) {
            return res.status(404).json({ success: false, message: 'Novel nahi mila!' });
        }

        return res.status(200).json(novel);
    } catch (error) {
        console.error("Fetch by slug error:", error);
        return res.status(500).json({ success: false, error: "Server error!" });
    }
};

module.exports = { createNovel, getNovelBySlug };