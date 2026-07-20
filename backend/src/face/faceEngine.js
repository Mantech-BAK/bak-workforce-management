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

function tensorFromCanvas(canvas) {
  const imageData = image.getImageData(canvas);
  return tf.tidy(() => {
    const data = tf.tensor(Array.from(imageData.data), [canvas.height, canvas.width, 4], 'int32');
    const channels = tf.split(data, 4, 2);
    const rgb = tf.stack([channels[0], channels[1], channels[2]], 2);
    return tf.squeeze(rgb);
  });
}

// Below this, faceapi's internal net-input conversion throws instead of just finding no
// face — observed to crash the whole process (an unhandled rejection outside the awaited
// chain, not something a local try/catch here reliably catches), so degenerate images are
// rejected before ever reaching detectSingleFace rather than after.
const MIN_IMAGE_DIMENSION = 40;

// Returns a 128-length descriptor array for the first detected face, or null if no face is
// found. empId is optional context for the failure-path logs below — none of these failures
// are otherwise recorded anywhere (no request logging middleware, no DB write), so without
// this they're indistinguishable after the fact.
async function getFaceDescriptor(imageBuffer, empId) {
  await init();

  const empLabel = empId || 'unknown';
  let canvas;
  try {
    canvas = await image.imageFromBuffer(imageBuffer);
  } catch (err) {
    console.error(
      `faceEngine: image decode failed for emp_id=${empLabel} (received ${imageBuffer.length} bytes): ${err.message}`
    );
    throw err;
  }

  if (canvas.width < MIN_IMAGE_DIMENSION || canvas.height < MIN_IMAGE_DIMENSION) {
    console.warn(
      `faceEngine: image too small for emp_id=${empLabel}, ${canvas.width}x${canvas.height} (received ${imageBuffer.length} bytes, minimum is ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION})`
    );
    return null;
  }

  const tensor = tensorFromCanvas(canvas);
  try {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    let result;
    try {
      result = await faceapi.detectSingleFace(tensor, options).withFaceLandmarks().withFaceDescriptor();
    } catch (err) {
      console.error(
        `faceEngine: face detection threw for emp_id=${empLabel}, image ${canvas.width}x${canvas.height} (received ${imageBuffer.length} bytes): ${err.message}`
      );
      return null;
    }

    if (!result) {
      console.warn(
        `faceEngine: no face detected for emp_id=${empLabel}, image ${canvas.width}x${canvas.height} (received ${imageBuffer.length} bytes)`
      );
      return null;
    }

    return Array.from(result.descriptor);
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
