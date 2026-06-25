const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const dbURI = process.env.MONGO_URI; 
        
        const conn = await mongoose.connect(dbURI, {
            family: 4 
        });
        
        console.log(`🚀 MongoDB Connected Successfully: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Database Connection Error: ${error.message}`);
        process.exit(1); 
    }
};

module.exports = connectDB;