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
    expect(response.body.received).toBe(2);
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
});
