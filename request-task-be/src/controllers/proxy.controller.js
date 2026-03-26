import Proxy from "../models/Proxy.model.js";

/**
 * GET /api/proxies
 * Lấy danh sách proxy (filter by status)
 */
export async function getAllProxies(req, res) {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const proxies = await Proxy.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Mask password
    const masked = proxies.map((p) => ({
      ...p,
      password: p.password ? "••••••••" : "",
    }));

    res.json({ success: true, data: masked });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/proxies
 * Thêm proxy mới — hỗ trợ single hoặc bulk
 * Body: { host, port, ... } hoặc { proxies: [{ host, port, ... }] }
 */
export async function createProxy(req, res) {
  try {
    // Bulk import
    if (req.body.proxies && Array.isArray(req.body.proxies)) {
      const docs = req.body.proxies.map((p) => ({
        host: p.host,
        port: Number(p.port),
        username: p.username || "",
        password: p.password || "",
        protocol: p.protocol || "http",
        country: p.country || "",
        city: p.city || "",
        status: p.status || "active",
        label: p.label || "",
      }));

      const result = await Proxy.insertMany(docs, { ordered: false }).catch(
        (err) => {
          // Partial success — some may have duplicate key errors
          if (err.insertedDocs) return err.insertedDocs;
          throw err;
        }
      );

      return res.json({
        success: true,
        data: result,
        message: `Imported ${Array.isArray(result) ? result.length : 0} proxies`,
      });
    }

    // Single insert
    const { host, port, username, password, protocol, country, city, label, status } = req.body;

    if (!host || !port) {
      return res.status(400).json({
        success: false,
        message: "host and port are required",
      });
    }

    const proxy = await Proxy.create({
      host,
      port: Number(port),
      username: username || "",
      password: password || "",
      protocol: protocol || "http",
      country: country || "",
      city: city || "",
      label: label || "",
      status: status || "active",
    });

    res.json({
      success: true,
      data: { ...proxy.toObject(), password: proxy.password ? "••••••••" : "" },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: `Proxy ${req.body.host}:${req.body.port} already exists`,
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PATCH /api/proxies/:id
 * Sửa proxy
 */
export async function updateProxy(req, res) {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData._id;
    if (updateData.port) updateData.port = Number(updateData.port);

    const proxy = await Proxy.findByIdAndUpdate(id, updateData, { new: true }).lean();

    if (!proxy) {
      return res.status(404).json({ success: false, message: "Proxy not found" });
    }

    res.json({
      success: true,
      data: { ...proxy, password: proxy.password ? "••••••••" : "" },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/proxies/:id
 * Xóa 1 proxy
 */
export async function deleteProxy(req, res) {
  try {
    const { id } = req.params;
    const proxy = await Proxy.findByIdAndDelete(id);

    if (!proxy) {
      return res.status(404).json({ success: false, message: "Proxy not found" });
    }

    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/proxies/bulk-delete
 * Xóa nhiều proxy
 * Body: { ids: ["id1", "id2", ...] }
 */
export async function bulkDeleteProxies(req, res) {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids array is required" });
    }

    const result = await Proxy.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} proxies`,
      data: { deleted_count: result.deletedCount },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/proxies/random
 * Lấy 1 proxy active ngẫu nhiên (cho worker gọi)
 * Trả về đầy đủ password (không mask)
 */
export async function getRandomProxy(req, res) {
  try {
    const count = await Proxy.countDocuments({ status: "active" });

    if (count === 0) {
      return res.json({ success: true, data: null, message: "No active proxy" });
    }

    const random = Math.floor(Math.random() * count);
    const proxy = await Proxy.findOne({ status: "active" }).skip(random).lean();

    res.json({ success: true, data: proxy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/proxies/check/:id
 * Check proxy alive bằng cách gọi httpbin.org qua proxy
 */
export async function checkProxy(req, res) {
  try {
    const { id } = req.params;
    const proxy = await Proxy.findById(id);

    if (!proxy) {
      return res.status(404).json({ success: false, message: "Proxy not found" });
    }

    const proxyUrl = proxy.username
      ? `${proxy.protocol || "http"}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
      : `${proxy.protocol || "http"}://${proxy.host}:${proxy.port}`;

    const startTime = Date.now();
    let alive = false;
    let responseTime = null;

    try {
      // Use HttpsProxyAgent for proxy support
      const { default: fetch } = await import("node-fetch");

      let agent;
      if (proxy.protocol === "socks5") {
        // socks5 requires a different agent — skip for now
        alive = false;
      } else {
        const { HttpsProxyAgent } = await import("https-proxy-agent");
        agent = new HttpsProxyAgent(proxyUrl);

        const response = await fetch("http://httpbin.org/ip", {
          agent,
          timeout: 15000,
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          alive = true;
          responseTime = Date.now() - startTime;
        }
      }
    } catch {
      alive = false;
      responseTime = Date.now() - startTime;
    }

    // Update proxy status
    const updatedProxy = await Proxy.findByIdAndUpdate(
      id,
      {
        status: alive ? "active" : "dead",
        last_checked: new Date(),
        response_time_ms: responseTime,
      },
      { new: true }
    ).lean();

    res.json({
      success: true,
      data: {
        ...updatedProxy,
        password: updatedProxy.password ? "••••••••" : "",
      },
      alive,
      response_time_ms: responseTime,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
