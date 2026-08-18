const mongoose = require('mongoose');

const novelSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        author: {
            type: String,
            default: 'Unknown Writer',
            trim: true
        },

        description: {
            type: String,
            default: ''
        },

        coverImage: {
            type: String,
            default: ''
        },

        status: {
            type: String,
            default: 'Ongoing'
        },

        category: {
            type: String,
            default: 'Newly Uploaded'
        },

        contentType: {
            type: String,
            default: 'novel'
        },

        hasChapters: {
            type: Boolean,
            default: false
        },

        mainPdf: {
            type: String,
            default: ''
        },

        views: {
            type: Number,
            default: 0
        },

        chapters: [
            {
                chapterTitle: {
                    type: String,
                    default: ''
                },

                chapterPdf: {
                    type: String,
                    required: true
                }
            }
        ]
    },

    {
        timestamps: true
    }
);

module.exports = mongoose.model('Novel', novelSchema);