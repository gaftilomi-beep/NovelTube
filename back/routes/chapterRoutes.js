const express = require('express');
const router = express.Router();
const { 
    createChapter, 
    getChaptersByNovel, 
    getChapterDetails,
    deleteChapter // <-- Isko yahan import karein
} = require('../controllers/chapterController');

router.post('/', createChapter);                                
router.get('/novel/:novelId', getChaptersByNovel);             
router.get('/novel/:novelId/:chapterNumber', getChapterDetails); 

// 🔥 NAYA ROUTE: Specific chapter delete karne ke liye
router.delete('/:chapterId', deleteChapter); 

module.exports = router;