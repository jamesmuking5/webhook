const request = require('supertest');
const app = require('./src/app');

// Demo test showing the exact scenario you described
async function demonstrateWebhook() {
  console.log('🔄 Testing webhook with JSON metadata + multiple OBJ files...\n');

  const jsonResponse = {
    "uuid": "eb1ccf9d-5ff4-4295-8170-843fe8162f76",
    "status": "completed",
    "result": {
      "mesh_filename": "patient006_4d_gt_4D_frame00_ED.obj",
      "mesh_file_size": 1234567,
      "total_mesh_files": 5,
      "total_mesh_size": 6789012,
      "mesh_format": "obj",
      "reconstruction_time": 45.67,
      "num_iterations": 150,
      "resolution": 128,
      "status": "reconstruction_completed",
      "message": "4D reconstruction completed successfully. 5 mesh files sent as multipart attachments.",
      "is_4d_input": true,
      "total_frames": 20,
      "ed_frame_index": 0,
      "processed_frames": 5,
      "temporal_info": {
        "type": "4d_sequence_phase2",
        "total_temporal_frames": 20,
        "processed_frame_indices": [0, 3, 6, 9, 12],
        "mesh_file_count": 5
      },
      "mesh_files_info": [
        {"filename": "patient006_4d_gt_4D_frame00_ED.obj", "size": 1234567, "frame_index": 0},
        {"filename": "patient006_4d_gt_4D_frame03.obj", "size": 1234567, "frame_index": 3},
        {"filename": "patient006_4d_gt_4D_frame06.obj", "size": 1234567, "frame_index": 6},
        {"filename": "patient006_4d_gt_4D_frame09.obj", "size": 1234567, "frame_index": 9},
        {"filename": "patient006_4d_gt_4D_frame12.obj", "size": 1234567, "frame_index": 12}
      ]
    },
    "error": null
  };

  const response = await request(app)
    .post('/webhook')
    .field('result', JSON.stringify(jsonResponse))
    .attach('meshes', Buffer.from('# Wavefront OBJ file - Frame 0 ED\nv 0.0 0.0 0.0\nv 1.0 0.0 0.0\nf 1 2'), 'patient006_4d_gt_4D_frame00_ED.obj')
    .attach('meshes', Buffer.from('# Wavefront OBJ file - Frame 3\nv 0.0 0.0 0.0\nv 1.0 0.0 0.0\nf 1 2'), 'patient006_4d_gt_4D_frame03.obj')
    .attach('meshes', Buffer.from('# Wavefront OBJ file - Frame 6\nv 0.0 0.0 0.0\nv 1.0 0.0 0.0\nf 1 2'), 'patient006_4d_gt_4D_frame06.obj')
    .attach('meshes', Buffer.from('# Wavefront OBJ file - Frame 9\nv 0.0 0.0 0.0\nv 1.0 0.0 0.0\nf 1 2'), 'patient006_4d_gt_4D_frame09.obj')
    .attach('meshes', Buffer.from('# Wavefront OBJ file - Frame 12\nv 0.0 0.0 0.0\nv 1.0 0.0 0.0\nf 1 2'), 'patient006_4d_gt_4D_frame12.obj');

  console.log('✅ Response Status:', response.status);
  console.log('📊 Summary:', JSON.stringify(response.body.summary, null, 2));
  console.log('📁 Files by Type:');
  console.log('  - OBJ files:', response.body.filesByType.obj.length);
  console.log('  - JSON files:', response.body.filesByType.json.length);
  console.log('  - Other files:', response.body.filesByType.other.length);
  console.log('📄 Has JSON metadata:', !!response.body.jsonData);
  console.log('💾 Metadata file saved:', !!response.body.metadataFile);
  console.log('📂 Upload directory:', response.body.uploadDir);
  
  console.log('\n🎯 OBJ Files received:');
  response.body.filesByType.obj.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file.originalName} (${file.size} bytes)`);
  });

  console.log('\n📋 JSON Metadata (first 3 keys):');
  const keys = Object.keys(response.body.jsonData);
  keys.slice(0, 3).forEach(key => {
    console.log(`  - ${key}: ${typeof response.body.jsonData[key]}`);
  });

  console.log('\n✨ Webhook successfully handled mixed multipart request!');
}

demonstrateWebhook().catch(console.error);