const mongoose = require('mongoose');

const writerSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    bio: { type: String, default: '' },
    image: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Writer', writerSchema);