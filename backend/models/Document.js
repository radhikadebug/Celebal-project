const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  contentType: {
    type: String,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  }
});

// Add a pre-save hook to ensure the path is using correct slashes for the OS
documentSchema.pre('save', function(next) {
  // Convert backslashes to forward slashes for consistent URL paths
  if (this.path && this.path.includes('\\')) {
    this.path = this.path.replace(/\\/g, '/');
  }
  next();
});

// Make sure there's only one export
const Document = mongoose.models.Document || mongoose.model('Document', documentSchema);
module.exports = Document;
