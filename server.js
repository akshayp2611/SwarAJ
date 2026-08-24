const express = require("express");
const path = require("path");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const {
  pool,
  initializeDatabase
} = require("./database");

const app = express();

const PORT = Number(process.env.PORT) || 10000;
const HOST = "0.0.0.0";

// ======================================================
// CLOUDINARY
// ======================================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,

  api_key: process.env.CLOUDINARY_API_KEY,

  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

// Serve frontend
app.use(
  express.static(__dirname)
);

// ======================================================
// MULTER
// ======================================================

// Files are temporarily stored in memory.
// They are NOT saved to Render filesystem.

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 100 * 1024 * 1024
  },

  fileFilter: (req, file, callback) => {
    const allowed = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/flac",
      "audio/mp4",
      "audio/aac"
    ];

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const validExtension = [
      ".mp3",
      ".wav",
      ".flac",
      ".m4a",
      ".aac"
    ].includes(extension);

    if (
      allowed.includes(file.mimetype) ||
      validExtension
    ) {
      callback(null, true);
    } else {
      callback(
        new Error(
          "Only audio files are allowed."
        )
      );
    }
  }
});

// ======================================================
// CLOUDINARY BUFFER UPLOAD
// ======================================================

function uploadAudioToCloudinary(
  buffer,
  originalName,
  category
) {
  return new Promise((resolve, reject) => {
    const safeCategory =
      String(category || "Other")
        .replace(/[^a-zA-Z0-9_-]/g, "_");

    const baseName =
      path
        .basename(
          originalName,
          path.extname(originalName)
        )
        .replace(/[^a-zA-Z0-9_-]/g, "_");

    const publicId =
      `swaraj/${safeCategory}/${Date.now()}_${baseName}`;

    const stream =
      cloudinary.uploader.upload_stream(
        {
          resource_type: "video",

          public_id: publicId,

          folder: `swaraj/${safeCategory}`,

          overwrite: false
        },

        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

    stream.end(buffer);
  });
}

// ======================================================
// HEALTH
// ======================================================

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    const countResult = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM songs
    `);

    res.json({
      status: "ok",

      service: "स्वरAJ Music",

      database: "connected",

      songCount:
        countResult.rows[0].count,

      cloudinary:
        process.env.CLOUDINARY_CLOUD_NAME
          ? "configured"
          : "not_configured",

      nodeVersion: process.version,

      environment:
        process.env.NODE_ENV || "production",

      timestamp:
        new Date().toISOString()
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: "error",

      database: "disconnected",

      message:
        "Database connection failed"
    });
  }
});

// ======================================================
// API ROOT
// ======================================================

app.get("/api", (req, res) => {
  res.json({
    status: "ok",

    service:
      "स्वरAJ Music API",

    endpoints: [
      "/api/health",
      "/api/categories",
      "/api/songs",
      "/api/upload"
    ]
  });
});

// ======================================================
// GET ALL SONGS
// ======================================================

app.get("/api/songs", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        artist,
        album,
        category,
        audio_url,
        cover_url,
        duration,
        created_at
      FROM songs
      ORDER BY created_at DESC
    `);

    res.json({
      status: "ok",

      count: result.rows.length,

      songs: result.rows
    });

  } catch (error) {
    console.error(
      "Songs API error:",
      error
    );

    res.status(500).json({
      status: "error",

      message:
        "Unable to load songs"
    });
  }
});

// ======================================================
// GET CATEGORIES
// ======================================================

app.get(
  "/api/categories",
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            category,
            COUNT(*)::int AS song_count
          FROM songs
          WHERE
            category IS NOT NULL
            AND TRIM(category) <> ''
          GROUP BY category
          ORDER BY category ASC
        `);

      res.json({
        status: "ok",

        categories:
          result.rows
      });

    } catch (error) {
      console.error(
        "Categories error:",
        error
      );

      res.status(500).json({
        status: "error",

        message:
          "Unable to load categories"
      });
    }
  }
);

// ======================================================
// SONGS BY CATEGORY
// ======================================================

app.get(
  "/api/categories/:category/songs",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            id,
            title,
            artist,
            album,
            category,
            audio_url,
            cover_url,
            duration
          FROM songs
          WHERE LOWER(category)
                = LOWER($1)
          ORDER BY title ASC
          `,
          [req.params.category]
        );

      res.json({
        status: "ok",

        category:
          req.params.category,

        count:
          result.rows.length,

        songs:
          result.rows
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        status: "error",

        message:
          "Unable to load category"
      });
    }
  }
);

// ======================================================
// SEARCH
// ======================================================

app.get(
  "/api/search",
  async (req, res) => {
    try {
      const q =
        String(req.query.q || "")
          .trim();

      if (!q) {
        return res.json({
          status: "ok",
          songs: []
        });
      }

      const result =
        await pool.query(
          `
          SELECT
            id,
            title,
            artist,
            album,
            category,
            audio_url,
            cover_url,
            duration
          FROM songs
          WHERE
            title ILIKE $1
            OR artist ILIKE $1
            OR album ILIKE $1
            OR category ILIKE $1
          ORDER BY title ASC
          LIMIT 100
          `,
          [`%${q}%`]
        );

      res.json({
        status: "ok",

        count:
          result.rows.length,

        songs:
          result.rows
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        status: "error",

        message:
          "Search failed"
      });
    }
  }
);

// ======================================================
// UPLOAD SONG
// ======================================================

app.post(
  "/api/upload",
  upload.single("song"),

  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: "error",

          message:
            "Please select an audio file."
        });
      }

      if (
        !process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET
      ) {
        return res.status(500).json({
          status: "error",

          message:
            "Cloudinary is not configured."
        });
      }

      const title =
        String(
          req.body.title ||
          path.basename(
            req.file.originalname,
            path.extname(
              req.file.originalname
            )
          )
        ).trim();

      const artist =
        String(
          req.body.artist ||
          "Unknown Artist"
        ).trim();

      const album =
        String(
          req.body.album ||
          "Unknown Album"
        ).trim();

      const category =
        String(
          req.body.category ||
          "Other"
        ).trim();

      console.log(
        `Uploading ${req.file.originalname}`
      );

      const cloud =
        await uploadAudioToCloudinary(
          req.file.buffer,

          req.file.originalname,

          category
        );

      const result =
        await pool.query(
          `
          INSERT INTO songs
          (
            title,
            artist,
            album,
            category,
            audio_url,
            cloudinary_public_id
          )
          VALUES
          ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (audio_url)
          DO UPDATE SET
            title = EXCLUDED.title,
            artist = EXCLUDED.artist,
            album = EXCLUDED.album,
            category = EXCLUDED.category
          RETURNING *
          `,
          [
            title,

            artist,

            album,

            category,

            cloud.secure_url,

            cloud.public_id
          ]
        );

      res.json({
        status: "ok",

        message:
          "Song uploaded successfully",

        song:
          result.rows[0]
      });

    } catch (error) {
      console.error(
        "Upload error:",
        error
      );

      res.status(500).json({
        status: "error",

        message:
          error.message ||
          "Upload failed"
      });
    }
  }
);

// ======================================================
// DELETE SONG
// ======================================================

app.delete(
  "/api/songs/:id",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            cloudinary_public_id
          FROM songs
          WHERE id = $1
          `,
          [req.params.id]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          status: "error",

          message:
            "Song not found"
        });
      }

      const publicId =
        result.rows[0]
          .cloudinary_public_id;

      if (publicId) {
        try {
          await cloudinary.uploader.destroy(
            publicId,
            {
              resource_type: "video"
            }
          );
        } catch (cloudError) {
          console.error(
            "Cloudinary delete error:",
            cloudError
          );
        }
      }

      await pool.query(
        `
        DELETE FROM songs
        WHERE id = $1
        `,
        [req.params.id]
      );

      res.json({
        status: "ok",

        message:
          "Song deleted successfully"
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        status: "error",

        message:
          "Unable to delete song"
      });
    }
  }
);

// ======================================================
// API 404
// ======================================================

app.use("/api", (req, res) => {
  res.status(404).json({
    status: "error",

    message:
      "API endpoint not found",

    path:
      req.originalUrl
  });
});

// ======================================================
// FRONTEND
// ======================================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "index.html"
    )
  );
});

// ======================================================
// ERROR HANDLER
// ======================================================

app.use(
  (error, req, res, next) => {
    console.error(error);

    res.status(500).json({
      status: "error",

      message:
        error.message ||
        "Server error"
    });
  }
);

// ======================================================
// START
// ======================================================

async function start() {
  try {
    await initializeDatabase();

    app.listen(
      PORT,
      HOST,
      () => {
        console.log(
          "=========================================="
        );

        console.log(
          "स्वरAJ Music Server"
        );

        console.log(
          "=========================================="
        );

        console.log(
          `Server: http://${HOST}:${PORT}`
        );

        console.log(
          "Database: configured"
        );

        console.log(
          "External audio: Cloudinary"
        );

        console.log(
          "=========================================="
        );
      }
    );

  } catch (error) {
    console.error(
      "Startup error:",
      error
    );

    process.exit(1);
  }
}

start();