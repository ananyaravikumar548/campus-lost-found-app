const mongoose = require('mongoose');

const foundItemSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: [true, 'Item name is required.'],
      trim: true,
      minlength: [2, 'Item name must be at least 2 characters.'],
      maxlength: [120, 'Item name cannot exceed 120 characters.']
    },
    category: {
      type: String,
      required: [true, 'Category is required.'],
      trim: true,
      enum: {
        values: [
          'Electronics',
          'Accessories',
          'Documents & IDs',
          'Books & Stationery',
          'Keys',
          'Clothing',
          'Bottles & Flasks',
          'Other'
        ],
        message: '{VALUE} is not a supported category.'
      }
    },
    description: {
      type: String,
      required: [true, 'Detailed description is required.'],
      trim: true,
      minlength: [5, 'Description should be at least 5 characters to help identify the item.']
    },
    foundLocation: {
      type: String,
      required: [true, 'Found location is required.'],
      trim: true
    },
    dateFound: {
      type: Date,
      required: [true, 'Date found is required.'],
      default: Date.now
    },
    status: {
      type: String,
      enum: ['Available', 'Claimed', 'Returned'],
      default: 'Available'
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Reporting student is required.']
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('FoundItem', foundItemSchema);
