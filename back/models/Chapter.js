const mongoose = require('mongoose');

const ChapterSchema = new mongoose.Schema({
    novelId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Novel', 
        required: true 
    }, // Yeh batayega ke yeh chapter kis novel ka hai
    chapterNumber: { type: Number, required: true },
    title: { type: String, required: true }, // e.g., Dil ki pehli dastak
    content: { type: String, required: true }, // Poori urdu kahani (text)
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Chapter', ChapterSchema);