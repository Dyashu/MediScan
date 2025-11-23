const express = require('express');
const multer = require('multer');
const Scan = require('../models/Scan');
const path = require('path');
const fs = require('fs');
const { spawn } = require("child_process");

const router = express.Router();

const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Always upload directly into "uploads" folder
    const folderPath = path.join(__dirname, "../uploads");
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    const { scanType, customName, userId } = req.body;
    const ext = path.extname(file.originalname);
    const safeUser = (userId || "nouser").replace(/[^\w.-]/g, "");
    const safeName = (customName || "unknown")
      .replace(/\s+/g, "_")
      .replace(/[^\w.-]/g, "");
    const safeType = (scanType || "unknown").replace(/[^\w.-]/g, "");
    const filename = `${safeType}_${safeUser}_${safeName}${ext}`;
    cb(null, filename);
  },
});
const upload = multer({ storage });

/** Upload Scan */
router.post("/upload", upload.single("scan"), async (req, res) => {
  try {
    const { userId, scanType, customName } = req.body;
    if (!req.file) return res.status(400).json({ msg: "No file uploaded" });

    // const scan = new Scan({
    //   user: userId,
    //   scanType,
    //   customName,
    //   filePath: req.file.path,
    // });
    // Store relative path instead of absolute
    const relativePath = path.relative(path.join(__dirname, "../"), req.file.path);

    const scan = new Scan({
      user: userId,
      scanType,
      customName,
      filePath: relativePath,
    });

    await scan.save();
    res.json({ msg: "Scan uploaded successfully", scan });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});


/** -----------------------------
 *  Get scans by user + type
 *  ----------------------------- */
router.get('/:userId/:scanType', async (req, res) => {
  try {
    const { userId, scanType } = req.params;
    const scans = await Scan.find({ user: userId, scanType }).sort({ createdAt: -1 });
    res.json(scans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /** -----------------------------
//  *  Get specific scan file
//  *  ----------------------------- */
router.get("/:userId/:scanType/file/:customName", async (req, res) => {
  try {
    const { scanType, customName, userId } = req.params;

    const scan = await Scan.findOne({
      scanType,
      customName,
      user: userId,  
    });

    if (!scan) return res.status(404).send("File not found");

    const absPath = path.resolve(path.join(__dirname, "../", scan.filePath));

    if (fs.existsSync(absPath)) {
      return res.sendFile(absPath);
    }

    res.status(404).send("File not found");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// router.get("/:userId/:scanType/file/:customName", async (req, res) => {
//   try {
//     const { scanType, customName } = req.params;
//     const scan = await Scan.findOne({ scanType, customName });

//     if (!scan) return res.status(404).send("File not found");

//     const relPath = path.resolve(path.join(__dirname, "../", scan.filePath));
//     if (fs.existsSync(relPath)) {
//       return res.sendFile(relPath);
//     }

//     res.status(404).send("File not found");
//   } catch (err) {
//     res.status(500).send("Server error");
//   }
// });

/** -----------------------------
 *  AI Prediction Route
 *  ----------------------------- */
router.post("/:userId/:scanType/file/:customName/ai/predict", async (req, res) => {
  try {
    const { userId, customName } = req.params;
    const scan = await Scan.findOne({ user: userId, customName });

    if (!scan || !fs.existsSync(path.join(__dirname, "../", scan.filePath))) {
      return res.status(404).json({ error: "Image not found" });
    }
    // ⭐ ADD DEBUG LOGS HERE
    // console.log("=== DEBUG PYTHON PATH ===");
    // console.log("model script:", path.join(__dirname, "../model/model_inference.py"));
    // console.log("image path:", scan.filePath, "Absolute:", path.resolve(scan.filePath));
    // console.log("Final IMAGE PATH:", path.join(__dirname, "../", scan.filePath));

    // const pythonProcess = spawn("python3", ["./model/model_inference.py", scan.filePath]);
    const pythonProcess = spawn("python3", [
      path.join(__dirname, "../model/model_inference.py"),
      path.join(__dirname, "../", scan.filePath)
    ]);
    
    let result = "";

    pythonProcess.stdout.on("data", (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error("Python error:", data.toString());
    });

    pythonProcess.on("close", async () => {
      try {
        const parsed = JSON.parse(result);
        console.log("FULL PYTHON OUTPUT:", parsed);
        // Determine Normal / Abnormal
        const topClass = Object.entries(parsed.probabilities)
          .sort((a, b) => b[1] - a[1])[0][0];
        const finalResult = topClass.toLowerCase() === "normal" ? "Normal" : "Abnormal";

        // ✅ Update simplified prediction schema
        scan.prediction.result = finalResult;
        scan.prediction.userFeedback = "";

        await scan.save();

        // res.json({ finalResult, probabilities: parsed.probabilities });
        res.json({
          finalResult,
          probabilities: parsed.probabilities,
          gradcam: parsed.gradcam   // <-- ADD THIS
        });
        
      } catch (err) {
        console.error("Error parsing model output:", err);
        res.status(500).json({ error: "Invalid model output" });
      }
    });
  } catch (err) {
    console.error("Prediction failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// router.post("/:userId/:scanType/file/:customName/ai/predict", async (req, res) => {
//   try {
//     const { customName } = req.params;
//     const scan = await Scan.findOne({ customName });

//     if (!scan || !fs.existsSync(scan.filePath)) {
//       return res.status(404).json({ error: "Image not found" });
//     }

//     // Run Python model
//     const pythonProcess = spawn("python", ["./model/model_inference.py", scan.filePath]);
//     let result = "";

//     pythonProcess.stdout.on("data", (data) => { result += data.toString(); });
//     pythonProcess.stderr.on("data", (data) => console.error("Python error:", data.toString()));

//     pythonProcess.on("close", async () => {
//       try {
//         const parsed = JSON.parse(result);
//         await Scan.findByIdAndUpdate(scan._id, { prediction: parsed });
//         res.json(parsed);
//       } catch (err) {
//         console.error("Error parsing model output:", err);
//         res.status(500).json({ error: "Invalid model output" });
//       }
//     });
//   } catch (err) {
//     console.error("Prediction failed:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

router.post("/:userId/:scanType/file/:customName/feedback", async (req, res) => {
  const { userId, scanType, customName } = req.params;
  const { feedback } = req.body;

  const validOptions = ["Right", "Wrong", "Not sure"];
  if (!validOptions.includes(feedback)) {
    return res.status(400).json({ error: "Invalid feedback option" });
  }

  const scan = await Scan.findOne({ user: userId, scanType, customName });
  if (!scan) return res.status(404).json({ error: "Scan not found" });

  scan.prediction.userFeedback = feedback;
  await scan.save();

  res.json({ msg: "Feedback saved successfully", feedback });
});

module.exports = router;
