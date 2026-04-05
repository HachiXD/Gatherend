const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const tf = require("@tensorflow/tfjs-node");
const nsfwjs = require("nsfwjs");

const app = express();
const port = Number.parseInt(process.env.PORT || "5000", 10);
const apiKey = process.env.CONTENT_MODERATION_API_KEY || "";
const modelUrl = process.env.NSFWJS_MODEL_URL || undefined;
const maxDimension = Number.parseInt(
  process.env.NSFWJS_MAX_DIMENSION || "1024",
  10,
);
const maxBytes = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxBytes,
  },
});

let modelPromise = null;

function ensureApiKey(req, res, next) {
  if (!apiKey) {
    return res
      .status(503)
      .json({ ok: false, error: "CONTENT_MODERATION_API_KEY_NOT_CONFIGURED" });
  }

  if (req.header("X-API-Key") !== apiKey) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  next();
}

async function getModel() {
  if (!modelPromise) {
    modelPromise = nsfwjs.load(modelUrl);
  }

  return modelPromise;
}

function extractClasses(predictions) {
  const classes = {
    Drawing: 0,
    Hentai: 0,
    Neutral: 0,
    Porn: 0,
    Sexy: 0,
  };

  for (const prediction of predictions) {
    if (Object.prototype.hasOwnProperty.call(classes, prediction.className)) {
      classes[prediction.className] = Math.round(prediction.probability * 10000) / 100;
    }
  }

  return classes;
}

async function prepareImageForInference(buffer) {
  const metadata = await sharp(buffer, { animated: true }).metadata();
  const animated = (metadata.pages || 1) > 1;

  let pipeline = animated ? sharp(buffer, { page: 0 }) : sharp(buffer);
  pipeline = pipeline.rotate();

  if (
    (metadata.width || 0) > maxDimension ||
    (metadata.height || 0) > maxDimension
  ) {
    pipeline = pipeline.resize(maxDimension, maxDimension, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const convertedBuffer = metadata.hasAlpha
    ? await pipeline.png().toBuffer()
    : await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();

  return {
    buffer: convertedBuffer,
    animated,
  };
}

app.get(["/", "/health"], async (_req, res) => {
  try {
    await getModel();
    res.json({ status: "ok", service: "nsfwjs" });
  } catch (error) {
    res.status(503).json({
      status: "error",
      service: "nsfwjs",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/moderate", ensureApiKey, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: "FILE_REQUIRED" });
  }

  if (!req.file.mimetype.startsWith("image/")) {
    return res.status(400).json({ ok: false, error: "INVALID_FILE_TYPE" });
  }

  try {
    const model = await getModel();
    const prepared = await prepareImageForInference(req.file.buffer);
    const tensor = tf.node.decodeImage(prepared.buffer, 3);

    try {
      const predictions = await model.classify(tensor);
      const classes = extractClasses(predictions);

      let topClass = "Neutral";
      let topConfidence = classes.Neutral;
      for (const [className, confidence] of Object.entries(classes)) {
        if (confidence > topConfidence) {
          topClass = className;
          topConfidence = confidence;
        }
      }

      return res.json({
        ok: true,
        engine: "nsfwjs",
        classes,
        topClass,
        topConfidence,
        animated: prepared.animated,
        analyzedFrames: 1,
      });
    } finally {
      tensor.dispose();
    }
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "INTERNAL_ERROR",
    });
  }
});

app.listen(port, () => {
  console.log(`[nsfwjs-service] listening on :${port}`);
});
