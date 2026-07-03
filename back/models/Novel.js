const mongoose = require('mongoose');

const novelSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, default: 'Unknown Writer' },
    description: { type: String },
    coverImage: { type: String },
    status: { type: String, default: 'Ongoing' }, 
    category: { type: String, default: 'Newly Uploaded' }, 
    hasChapters: { type: Boolean, default: false },
    mainPdf: { type: String },
    views: { type: Number, default: 0 },
    // 🔥 FIX: Chapters ka array schema mein add kar diya taake MongoDB mein data save ho sake!
    chapters: [
        {
            chapterTitle: { type: String },
            chapterPdf: { type: String }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Novel', novelSchema);