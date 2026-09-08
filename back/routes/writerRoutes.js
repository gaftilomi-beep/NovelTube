const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const uploadsDir = path.join('/tmp', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `writer-${Date.now()}${path.extname(file.originalname)}`)
});

const upload = multer({ storage });

const getWriterModel = () => {
    try {
        return mongoose.model('Writer');
    } catch {
        const writerSchema = new mongoose.Schema({
            name: { type: String, required: true },
            bio: { type: String, default: '' },
            photoUrl: { type: String, default: '' },
            image: { type: String, default: '' }
        }, { timestamps: true });
        return mongoose.model('Writer', writerSchema);
    }
};

// GET All Writers
router.get('/', async (req, res) => {
    try {
        const Writer = getWriterModel();
        const writers = await Writer.find().sort({ createdAt: -1 });
        res.json(writers);
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to fetch writers' });
    }
});

// POST New Writer
router.post('/', upload.single('photo'), async (req, res) => {
    try {
        const Writer = getWriterModel();
        const { name, bio, photoUrl, image, password } = req.body;
        if (password && password !== 'mywifesaba') return res.status(401).json({ message: 'Unauthorized' });

        let img = req.file ? `/uploads/${req.file.filename}` : (photoUrl || image || '');
        const newWriter = new Writer({ name, bio, photoUrl: img, image: img });
        await newWriter.save();
        res.status(201).json({ success: true, writer: newWriter });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT Update Writer
router.put('/:id', upload.single('photo'), async (req, res) => {
    try {
        const Writer = getWriterModel();
        const { name, bio, photoUrl, password } = req.body;
        if (password && password !== 'mywifesaba') return res.status(401).json({ message: 'Unauthorized' });

        const updateData = { name, bio };
        if (req.file) {
            updateData.photoUrl = `/uploads/${req.file.filename}`;
            updateData.image = `/uploads/${req.file.filename}`;
        } else if (photoUrl) {
            updateData.photoUrl = photoUrl;
            updateData.image = photoUrl;
        }

        const updatedWriter = await Writer.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });
        res.json({ success: true, writer: updatedWriter });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE Writer (Fixing 404 Route Issue)
router.delete('/:id', async (req, res) => {
    try {
        const Writer = getWriterModel();
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid Writer ID' });
        }

        const deletedWriter = await Writer.findByIdAndDelete(id);
        if (!deletedWriter) {
            return res.status(404).json({ success: false, message: 'Writer nahi mila!' });
        }

        return res.json({ success: true, message: 'Writer successfully deleted' });
    } catch (err) {
        console.error('Delete Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;