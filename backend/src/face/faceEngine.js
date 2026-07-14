const path = require('path');
const tf = require('@tensorflow/tfjs');
const wasm = require('@tensorflow/tfjs-backend-wasm');
const image = require('@canvas/image');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');

const MODEL_PATH = path.join(__dirname, '../../node_modules/@vladmandic/face-api/model');
const WASM_PATH = path.join(__dirname, '../../node_modules/@tensorflow/tfjs-backend-wasm/dist') + path.sep;

let initPromise = null;

function init() {
  if (!initPromise) {
    initPromise = (async () => {
      wasm.setWasmPaths(WASM_PATH);
      await tf.setBackend('wasm');
      await tf.ready();
      await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
    })();
  }
  return initPromise;
}

async function bufferToTensor(buffer) {
  const canvas = await image.imageFromBuffer(buffer);
  const imageData = image.getImageData(canvas);
  return tf.tidy(() => {
    const data = tf.tensor(Array.from(imageData.data), [canvas.height, canvas.width, 4], 'int32');
    const channels = tf.split(data, 4, 2);
    const rgb = tf.stack([channels[0], channels[1], channels[2]], 2);
    return tf.squeeze(rgb);
  });
}

// Returns a 128-length descriptor array for the first detected face, or null if no face is found.
async function getFaceDescriptor(imageBuffer) {
  await init();
  const tensor = await bufferToTensor(imageBuffer);
  try {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    const result = await faceapi
      .detectSingleFace(tensor, options)
      .withFaceLandmarks()
      .withFaceDescriptor();
    return result ? Array.from(result.descriptor) : null;
  } finally {
    tf.dispose(tensor);
  }
}

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

// Similarity in roughly [0, 1], higher = more similar. Same-person distances are
// typically well under 1, different-person distances typically well over it.
function similarity(descriptorA, descriptorB) {
  return Math.max(0, 1 - euclideanDistance(descriptorA, descriptorB));
}

module.exports = { getFaceDescriptor, similarity };
