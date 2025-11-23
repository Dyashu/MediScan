const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const Scan = require("../models/Scan");
const { spawn } = require("child_process");

// POST — Save Annotation
router.post("/:userId/:scanType/:customName/annotate", async (req, res) => {
  try {
    const { userId, scanType, customName } = req.params;
    const { maskData, remarks } = req.body;

    console.log("Annotation Request Params:", { userId, scanType, customName });

    if (!maskData)
      return res.status(400).json({ error: "Missing annotation mask data" });

    const scan = await Scan.findOne({ user: userId, scanType, customName });
    if (!scan) return res.status(404).json({ error: "Scan not found" });
    if (scan.annotation && scan.annotation.maskPath) {
      return res
        .status(400)
        .json({ error: "Annotation already exists for this scan." });
    }
    console.log("Found scan in DB:", scan.filePath);

    if (!fs.existsSync(scan.filePath))
      return res.status(404).json({ error: "Scan file missing on server" });

    // Use absolute path for saving, relative path for DB
    const outputDir = path.join(__dirname, "../", "annotations");
    fs.mkdirSync(outputDir, { recursive: true });

    const maskFileName = `${scanType}_${userId}_${customName}_mask.png`;
    const processedFileName = `${scanType}_${userId}_${customName}_annotation_processed.png`;

    const absMaskPath = path.join(outputDir, maskFileName);
    const absProcessedPath = path.join(outputDir, processedFileName);

    // Save mask image
    const maskBase64 = maskData.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(absMaskPath, Buffer.from(maskBase64, "base64"));
    console.log("Saved mask to:", absMaskPath);

    // Run Python process
    const pythonProcess = spawn("python3", [
      "utils/process_annotation.py",
      scan.filePath,
      absMaskPath,
      absProcessedPath,
    ]);

    pythonProcess.stdout.on("data", (data) =>
      console.log("Python Output:", data.toString())
    );
    pythonProcess.stderr.on("data", (data) =>
      console.error("Python Error:", data.toString())
    );

    pythonProcess.on("close", async (code) => {
      console.log(`Python process exited with code ${code}`);

      // Convert absolute → relative before storing
      const relativeMaskPath = path.relative(
        path.join(__dirname, "../"),
        absMaskPath
      );
      const relativeProcessedPath = path.relative(
        path.join(__dirname, "../"),
        absProcessedPath
      );

      // Update DB with relative paths
      scan.annotation = {
        maskPath: relativeMaskPath,
        processedPath: relativeProcessedPath,
        remarks: remarks || "",
        createdAt: new Date(),
      };

      await scan.save();

      console.log("Annotation saved successfully to DB");
      res.json({
        success: true,
        message: "Annotation saved successfully",
        annotation: scan.annotation,
      });
    });
  } catch (err) {
    console.error("Annotation route error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET — Fetch annotation for a scan
router.get("/:userId/:scanType/:customName", async (req, res) => {
  try {
    const { userId, scanType, customName } = req.params;
    const scan = await Scan.findOne({ user: userId, scanType, customName });

    if (!scan) return res.status(404).json({ error: "Scan not found" });
    if (!scan.annotation)
      return res.json({ annotation: null, message: "No annotation found" });

    // Add full URLs for frontend convenience
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const annotationWithUrls = {
      ...scan.annotation,
      maskUrl: `${baseUrl}/${scan.annotation.maskPath}`,
      processedUrl: `${baseUrl}/${scan.annotation.processedPath}`,
    };

    res.json({ annotation: annotationWithUrls });
  } catch (err) {
    console.error("Annotation fetch failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
