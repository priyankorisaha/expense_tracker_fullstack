const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxLength: 80,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        passwordHash: {
            type: String,
            required: true,
        },
        currency: {
            type: String,
            default: 'USD',
            trim: true,
        },
        timezone: {
            type: String,
            default: 'UTC',
            trim: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
