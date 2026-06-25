const mongoose = require('mongoose'); // 🔥 Galti yahan thi! Yeh line daalna zaroori hai.

const novelSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, default: 'Unknown Writer' },
    description: { type: String, required: true },
    coverImage: { type: String, required: true },
    status: { type: String, enum: ['Ongoing', 'Completed'], default: 'Completed' },
    
    // 🔥 NAYA FEATURE: Is line se har novel ki apni category database mein save hogi
    category: { type: String, default: 'Newly Uploaded' }, 
    
    hasChapters: { type: Boolean, default: false }, 
    mainPdf: { type: String }, 
    chapters: [{
        chapterTitle: String,
        chapterPdf: String
    }]
});

// Model ko export zaroor karein taaki controllers mein use ho sake
module.exports = mongoose.model('Novel', novelSchema);