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

// Multipart form data file limits
const upload = multer({
  storage,
  limits: {
    files: 50,
    fileSize: 20 * 1024 * 1024 // 20 MB per file
  }
});

const app = express();

app.use(express.json({ limit: '100mb' }));

app.post('/webhook', upload.any(), (req, res) => {
  // Handle pure JSON requests
  if (req.is('application/json')) {
    console.log('Received JSON body:', JSON.stringify(req.body, null, 2));

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uploadDir = path.join(uploadsRoot, timestamp);
    fs.mkdirSync(uploadDir, { recursive: true });

    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-data.json`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));

    return res.json({
      message: 'JSON received and saved',
      file: filename,
      uploadDir: path.relative(process.cwd(), uploadDir),
      path: path.relative(process.cwd(), filePath)
    });
  }

  // Handle multipart requests (can include files and/or JSON field data)
  let jsonData = null;
  
  // First, check if JSON data was sent as a form field
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    // Look for common JSON field names or try to parse any field that looks like JSON
    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'json' || key === 'data' || key === 'metadata' || key === 'result') {
        try {
          jsonData = typeof value === 'string' ? JSON.parse(value) : value;
          console.log(`Received JSON from form field '${key}':`, JSON.stringify(jsonData, null, 2));
          break;
        } catch (e) {
          console.error(`Error parsing JSON from form field '${key}':`, e.message);
        }
      }
    }
    
    // If no specific JSON field found, check if the entire body looks like JSON
    if (!jsonData) {
      try {
        // Check if any field contains JSON-like data
        for (const [key, value] of Object.entries(req.body)) {
          if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
            jsonData = JSON.parse(value);
            console.log(`Received JSON from form field '${key}' (auto-detected):`, JSON.stringify(jsonData, null, 2));
            break;
          }
        }
      } catch (e) {
        // Not JSON, that's okay
      }
    }
  }

  // Then, check for JSON files in uploads
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      if (file.mimetype === 'application/json' || file.originalname.toLowerCase().endsWith('.json')) {
        try {
          const content = fs.readFileSync(file.path, 'utf8');
          const fileJsonData = JSON.parse(content);
          console.log('Received JSON from file:', JSON.stringify(fileJsonData, null, 2));
          
          // If we already have JSON from form fields, merge or use file data
          if (jsonData) {
            console.log('Note: Found JSON in both form field and file. Using file data.');
          }
          jsonData = fileJsonData;
        } catch (e) {
          console.error('Error parsing JSON file:', e.message);
        }
      }
    }
  }

  // Require either files or JSON data
  if ((!req.files || req.files.length === 0) && !jsonData) {
    return res.status(400).json({
      error: 'At least one file or JSON data is required.'
    });
  }

  // Ensure upload directory exists (for metadata or files)
  let uploadDir = req.uploadDir;
  if (!uploadDir && jsonData) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    uploadDir = path.join(uploadsRoot, timestamp);
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Save JSON metadata if present
  let metadataFile = null;
  if (jsonData && uploadDir) {
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-metadata.json`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
    metadataFile = {
      filename,
      path: path.relative(process.cwd(), filePath)
    };
  }

  const files = req.files ? req.files.map((file) => ({
    fieldName: file.fieldname,
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    path: path.relative(process.cwd(), file.path)
  })) : [];

  // Categorize files by type for better organization
  const filesByType = {
    obj: files.filter(f => f.mimeType === 'application/octet-stream' || f.originalName.toLowerCase().endsWith('.obj')),
    json: files.filter(f => f.mimeType === 'application/json' || f.originalName.toLowerCase().endsWith('.json')),
    other: files.filter(f => !f.originalName.toLowerCase().endsWith('.obj') && !f.originalName.toLowerCase().endsWith('.json'))
  };

  return res.json({
    message: 'Files and data received successfully',
    summary: {
      totalFiles: files.length,
      objFiles: filesByType.obj.length,
      jsonFiles: filesByType.json.length,
      otherFiles: filesByType.other.length,
      hasJsonMetadata: !!jsonData
    },
    files,
    filesByType,
    formFields: req.body,
    jsonData,
    metadataFile,
    uploadDir: uploadDir ? path.relative(process.cwd(), uploadDir) : null
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
