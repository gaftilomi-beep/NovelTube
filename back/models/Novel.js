const mongoose = require('mongoose');

const novelSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, default: 'Unknown Writer' },
    description: { type: String },
    coverImage: { type: String },
    // 🚨 KHabardar: Yahan unique: true NAHI hona chahiye!
    category: { type: String, default: 'Newly Uploaded' }, 
    hasChapters: { type: Boolean, default: false },
    mainPdf: { type: String },
    views: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Novel', novelSchema);