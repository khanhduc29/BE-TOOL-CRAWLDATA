import express from "express";
import ApiKey from "../models/ApiKey.model.js";

const router = express.Router();

// GET /api/api-keys?service=youtube — list keys for a service
router.get("/", async (req, res) => {
  try {
    const query = {};
    if (req.query.service) query.service = req.query.service;

    const keys = await ApiKey.find(query).sort({ createdAt: -1 }).lean();
    // Mask key values for security (show first 8 + last 4 chars)
    const masked = keys.map((k) => ({
      ...k,
      key_masked:
        k.key.length > 12
          ? k.key.slice(0, 8) + "••••" + k.key.slice(-4)
          : "••••••••",
    }));

    res.json({ success: true, data: masked });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/api-keys — add new key
router.post("/", async (req, res) => {
  try {
    const { service, key, label } = req.body;
    if (!service || !key) {
      return res
        .status(400)
        .json({ success: false, message: "service and key are required" });
    }

    // Check duplicate
    const exists = await ApiKey.findOne({ service, key });
    if (exists) {
      return res
        .status(400)
        .json({ success: false, message: "API key đã tồn tại" });
    }

    const apiKey = await ApiKey.create({ service, key, label: label || "" });
    res.json({ success: true, data: apiKey });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/api-keys/:id — update key (status, label)
router.put("/:id", async (req, res) => {
  try {
    const { status, label, key } = req.body;
    const update = {};
    if (status) update.status = status;
    if (label !== undefined) update.label = label;
    if (key) update.key = key;
    if (status === "active") update.last_error = "";

    const apiKey = await ApiKey.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });
    if (!apiKey) {
      return res
        .status(404)
        .json({ success: false, message: "Key not found" });
    }

    res.json({ success: true, data: apiKey });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/api-keys/:id — remove key
router.delete("/:id", async (req, res) => {
  try {
    await ApiKey.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/api-keys/next — get next available key (for workers)
router.post("/next", async (req, res) => {
  try {
    const { service } = req.body;
    if (!service) {
      return res
        .status(400)
        .json({ success: false, message: "service is required" });
    }

    const key = await ApiKey.getNextKey(service);
    if (!key) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Không có API key nào khả dụng cho " + service,
        });
    }

    res.json({ success: true, data: { _id: key._id, key: key.key } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/api-keys/:id/error — mark key as exhausted
router.post("/:id/error", async (req, res) => {
  try {
    const { error_message } = req.body;
    await ApiKey.markKeyError(req.params.id, error_message || "Quota exceeded");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/api-keys/reset — reset all exhausted keys for a service
router.post("/reset", async (req, res) => {
  try {
    const { service } = req.body;
    const result = await ApiKey.resetExhaustedKeys(service);
    res.json({ success: true, data: { reset: result.modifiedCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
