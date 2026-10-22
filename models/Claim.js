const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema(
  {
    foundItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoundItem',
      required: [true, 'Found item reference is required.']
    },
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Claiming student reference is required.']
    },
    reason: {
      type: String,
      required: [true, 'Reason or proof of ownership is required.'],
      trim: true,
      minlength: [10, 'Please provide sufficient reason or identifying details (at least 10 characters).']
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending'
    },
    reviewedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate claims by the same student for the same found item
claimSchema.index({ foundItemId: 1, claimedBy: 1 }, { unique: true });

module.exports = mongoose.model('Claim', claimSchema);
