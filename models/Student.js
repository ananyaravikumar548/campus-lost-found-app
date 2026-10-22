const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Student full name is required.'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters.'],
      maxlength: [100, 'Full name cannot exceed 100 characters.']
    },
    email: {
      type: String,
      required: [true, 'College email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid college email address.'
      ]
    },
    department: {
      type: String,
      required: [true, 'Department is required.'],
      trim: true,
      minlength: [2, 'Department must be at least 2 characters.']
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required.'],
      trim: true,
      match: [
        /^[0-9+\-\s()]{7,15}$/,
        'Please provide a valid contact number (7-15 digits).'
      ]
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Student', studentSchema);
