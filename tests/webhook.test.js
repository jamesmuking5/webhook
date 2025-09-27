const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');

const uploadsRoot = path.resolve(__dirname, '..', 'uploads');

afterEach(() => {
  if (fs.existsSync(uploadsRoot)) {
    fs.rmSync(uploadsRoot, { recursive: true, force: true });
  }

  fs.mkdirSync(uploadsRoot, { recursive: true });
});

describe('POST /webhook', () => {
  it('accepts multipart uploads with one or more files', async () => {
    const response = await request(app)
      .post('/webhook')
      .field('event', 'test')
      .attach('files', Buffer.from('hello world'), 'hello.txt')
      .attach('files', Buffer.from('another file'), 'another.txt');

    expect(response.statusCode).toBe(200);
    expect(response.body.summary.totalFiles).toBe(2);
    expect(response.body.files).toHaveLength(2);
    expect(response.body.formFields.event).toBe('test');
    expect(response.body.files[0]).toHaveProperty('originalName');
    expect(response.body).toHaveProperty('uploadDir');

    const uploadDir = path.resolve(process.cwd(), response.body.uploadDir);
    expect(fs.existsSync(uploadDir)).toBe(true);

    response.body.files.forEach((file) => {
      expect(file).toHaveProperty('storedName');
      expect(file).toHaveProperty('path');
      const absolutePath = path.resolve(process.cwd(), file.path);
      expect(absolutePath.startsWith(uploadDir)).toBe(true);
      expect(fs.existsSync(absolutePath)).toBe(true);
      const diskStat = fs.statSync(absolutePath);
      expect(diskStat.size).toBe(file.size);
    });
  });

  it('returns 400 when no files are provided', async () => {
    const response = await request(app)
      .post('/webhook')
      .field('event', 'missing-files');

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('accepts JSON body and saves it', async () => {
    const jsonData = { event: 'test-json', data: { key: 'value' } };

    const response = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .send(jsonData);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('JSON received and saved');
    expect(response.body).toHaveProperty('file');
    expect(response.body).toHaveProperty('uploadDir');
    expect(response.body).toHaveProperty('path');

    const uploadDir = path.resolve(process.cwd(), response.body.uploadDir);
    expect(fs.existsSync(uploadDir)).toBe(true);

    const filePath = path.resolve(process.cwd(), response.body.path);
    expect(fs.existsSync(filePath)).toBe(true);

    const savedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(savedData).toEqual(jsonData);
  });

  it('parses JSON file in multipart upload', async () => {
    const jsonData = { event: 'test-json-file', data: { key: 'value' } };
    const jsonBuffer = Buffer.from(JSON.stringify(jsonData));

    const response = await request(app)
      .post('/webhook')
      .field('event', 'multipart-with-json')
      .attach('files', jsonBuffer, 'data.json')
      .attach('files', Buffer.from('obj content'), 'model.obj');

    expect(response.statusCode).toBe(200);
    expect(response.body.summary.totalFiles).toBe(2); // original files
    expect(response.body.files).toHaveLength(2);
    expect(response.body.jsonData).toEqual(jsonData);
    expect(response.body.formFields.event).toBe('multipart-with-json');
    expect(response.body).toHaveProperty('metadataFile');
    expect(response.body.metadataFile).toHaveProperty('filename');
    expect(response.body.metadataFile).toHaveProperty('path');

    const uploadDir = path.resolve(process.cwd(), response.body.uploadDir);
    expect(fs.existsSync(uploadDir)).toBe(true);

    response.body.files.forEach((file) => {
      const absolutePath = path.resolve(process.cwd(), file.path);
      expect(fs.existsSync(absolutePath)).toBe(true);
    });

    const metadataPath = path.resolve(process.cwd(), response.body.metadataFile.path);
    expect(fs.existsSync(metadataPath)).toBe(true);
    const savedMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    expect(savedMetadata).toEqual(jsonData);
  });

  it('handles complex multipart with JSON field and multiple OBJ files', async () => {
    const jsonMetadata = {
      uuid: "eb1ccf9d-5ff4-4295-8170-843fe8162f76",
      status: "completed",
      result: {
        mesh_filename: "patient006_4d_gt_4D_frame00_ED.obj",
        mesh_file_size: 1234567,
        total_mesh_files: 5,
        total_mesh_size: 6789012,
        mesh_format: "obj",
        reconstruction_time: 45.67,
        num_iterations: 150,
        resolution: 128,
        status: "reconstruction_completed",
        message: "4D reconstruction completed successfully. 5 mesh files sent as multipart attachments.",
        is_4d_input: true,
        total_frames: 20,
        ed_frame_index: 0,
        processed_frames: 5,
        temporal_info: {
          type: "4d_sequence_phase2",
          total_temporal_frames: 20,
          processed_frame_indices: [0, 3, 6, 9, 12],
          mesh_file_count: 5
        },
        mesh_files_info: [
          {"filename": "patient006_4d_gt_4D_frame00_ED.obj", "size": 1234567, "frame_index": 0},
          {"filename": "patient006_4d_gt_4D_frame03.obj", "size": 1234567, "frame_index": 3}
        ]
      },
      error: null
    };

    const response = await request(app)
      .post('/webhook')
      .field('result', JSON.stringify(jsonMetadata))
      .attach('meshes', Buffer.from('# OBJ file content frame 0'), 'patient006_4d_gt_4D_frame00_ED.obj')
      .attach('meshes', Buffer.from('# OBJ file content frame 3'), 'patient006_4d_gt_4D_frame03.obj')
      .attach('meshes', Buffer.from('# OBJ file content frame 6'), 'patient006_4d_gt_4D_frame06.obj');

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Files and data received successfully');
    expect(response.body.summary.totalFiles).toBe(3);
    expect(response.body.summary.objFiles).toBe(3);
    expect(response.body.summary.hasJsonMetadata).toBe(true);
    expect(response.body.jsonData).toEqual(jsonMetadata);
    expect(response.body.filesByType.obj).toHaveLength(3);
    expect(response.body).toHaveProperty('metadataFile');

    // Verify all files are saved
    const uploadDir = path.resolve(process.cwd(), response.body.uploadDir);
    expect(fs.existsSync(uploadDir)).toBe(true);

    // Check OBJ files
    response.body.filesByType.obj.forEach((file) => {
      expect(file.originalName.endsWith('.obj')).toBe(true);
      const absolutePath = path.resolve(process.cwd(), file.path);
      expect(fs.existsSync(absolutePath)).toBe(true);
    });

    // Check metadata file
    const metadataPath = path.resolve(process.cwd(), response.body.metadataFile.path);
    expect(fs.existsSync(metadataPath)).toBe(true);
    const savedMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    expect(savedMetadata).toEqual(jsonMetadata);
  });

  it('handles JSON-only requests (no files)', async () => {
    const jsonData = { message: 'JSON only request', data: { test: true } };
    
    const response = await request(app)
      .post('/webhook')
      .field('json', JSON.stringify(jsonData));

    expect(response.statusCode).toBe(200);
    expect(response.body.summary.totalFiles).toBe(0);
    expect(response.body.summary.hasJsonMetadata).toBe(true);
    expect(response.body.jsonData).toEqual(jsonData);
    expect(response.body).toHaveProperty('metadataFile');
  });
});
