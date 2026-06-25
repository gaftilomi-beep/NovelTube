const express = require('express');
const router = express.Router();
const { createChapter, getChaptersByNovel, getChapterDetails } = require('../controllers/chapterController');

router.post('/', createChapter);                                // POST: /api/chapters (Naya chapter daalne ke liye)
router.get('/novel/:novelId', getChaptersByNovel);             // GET: /api/chapters/novel/:novelId (Novel ke saare chapters)
router.get('/novel/:novelId/:chapterNumber', getChapterDetails); // GET: /api/chapters/novel/:novelId/:chapterNumber (Reading page)

module.exports = router;