const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // ISP Block Torne Ke Liye

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path'); 
const connectDB = require('./config/db.js');

dotenv.config();
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// 🔥 FIXED: Ab server 'public' ke bajaye aapke 'front' folder ko check karega
app.use(express.static(path.join(__dirname, 'front')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 

// Route Links Connect Karein
app.use('/api/novels', require('./routes/novelRoutes'));
app.use('/api/chapters', require('./routes/chapterRoutes'));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`🔥 Server is running smoothly on port ${PORT}`);
});