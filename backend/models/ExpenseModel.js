
 const mongoose = require('mongoose');
 
const ExpenseSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
       title: {
            type: String,
            required: true,
            trim: true,
            maxLength: 50,
        },
        amount: {
            type: Number,
            required: true,
            maxLength: 20,
            trim: true,
        },
        type: {
            type: String,
            default: 'expense',
        },
        date: {
            type: Date,
            required: true,
            trim: true,
       },
        category: {
            type: String,
            required: true,
            trim: true,
        },
        merchant: {
            type: String,
            trim: true,
            default: 'Unknown',
        },
        aiConfidence: {
            type: Number,
            default: 0,
        },
        aiReason: {
            type: String,
            trim: true,
            default: '',
        },
        description: {
            type: String,
            required: true,
            maxLength: 120,
            trim: true,
        },
     },

    { timestamps: true }
);
 

module.exports = mongoose.model('Expense', ExpenseSchema);
