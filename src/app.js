const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsRoot = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (!req.uploadDir) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      req.uploadSubdir = timestamp;
      req.uploadDir = path.join(uploadsRoot, timestamp);
      fs.mkdirSync(req.uploadDir, { recursive: true });
    }

    cb(null, req.uploadDir);
  },
  filename(req, file, cb) {
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${sanitizedOriginalName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    files: 20,
    fileSize: 10 * 1024 * 1024 // 10 MB per file
  }
});

const app = express();

app.post('/webhook', upload.any(), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      error: 'At least one file is required.'
    });
  }

  const files = req.files.map((file) => ({
    fieldName: file.fieldname,
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    path: path.relative(process.cwd(), file.path)
  }));

  return res.json({
    received: files.length,
    files,
    formFields: req.body,
    uploadDir: req.uploadDir ? path.relative(process.cwd(), req.uploadDir) : null
  });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: err.message
    });
  }

  if (err) {
    return res.status(500).json({
      error: 'Unexpected server error.'
    });
  }

  return next();
});

module.exports = app;
