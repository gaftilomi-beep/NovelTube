const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // 🔥 FIX: Dono variables check karein taake koi bhi missing na ho
        const dbURI = process.env.MONGO_URI || process.env.MONGODB_URI; 
        
        if (!dbURI) {
            throw new Error("Database URI is completely missing in environment variables!");
        }

        const conn = await mongoose.connect(dbURI, {
            family: 4 
        });
        
        console.log(`🚀 MongoDB Connected Successfully: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Database Connection Error: ${error.message}`);
        process.exit(1); // Agar connection fail hui tu hi exit karega
    }
};

module.exports = connectDB;