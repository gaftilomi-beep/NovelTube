const express = require('express');
const router = express.Router();
const Writer = require('../models/Writer');

// 1. Get all writers
router.get('/', async (req, res) => {
    try {
        const writers = await Writer.find().sort({ name: 1 });
        res.json(writers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. Add new writer (Password Verified)
router.post('/', async (req, res) => {
    const { name, bio, image, photoUrl, password } = req.body;

    // Verify Password
    if (password !== 'mywifesaba') {
        return res.status(401).json({ message: 'Unauthorized! Wrong password.' });
    }

    try {
        // Support both field names for frontend compatibility
        const imageUrl = image || photoUrl || '';
        const newWriter = new Writer({ name, bio, image: imageUrl, photoUrl: imageUrl });
        
        await newWriter.save();
        res.status(201).json({ message: 'Writer saved successfully!', writer: newWriter });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;