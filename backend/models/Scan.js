const mongoose = require('mongoose');

const ScanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scanType: { type: String, required: true }, // "xray", "mri", "oct"
  customName: { type: String, required: true }, 
  filePath: { type: String, required: true },
  prediction: {
    result: { type: String, enum: ["Normal", "Abnormal", "Unknown"], default: "Unknown" },
    userFeedback: {
      type: String,
      enum: ["Right", "Wrong", "Not sure", ""],
      default: "",
    },
  },
  annotation: {
    maskPath: String,
    processedPath: String,
    remarks: String,
    createdAt: { type: Date, default: Date.now },
  },
}, { timestamps: true });

module.exports = mongoose.model('Scan', ScanSchema);
