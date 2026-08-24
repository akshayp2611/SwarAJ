const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const ROOT_DIR = __dirname;
const SONGS_DIR = path.join(ROOT_DIR, "songs");
const IMAGES_DIR = path.join(ROOT_DIR, "images");
const DATA_DIR = path.join(ROOT_DIR, "data");
const YOUTUBE_FILE = path.join(DATA_DIR, "youtube.json");

const ADMIN_KEY =
  process.env.ADMIN_KEY || "change-this-admin-key";

const YOUTUBE_API_KEY =
  process.env.YOUTUBE_API_KEY || "";

const MAX_UPLOAD_SIZE =
  100 * 1024 * 1024;

// --------------------------------------------------
// Directories
// --------------------------------------------------

for (const directory of [
  SONGS_DIR,
  DATA_DIR
]) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {
      recursive: true
    });
  }
}

if (!fs.existsSync(YOUTUBE_FILE)) {
  fs.writeFileSync(
    YOUTUBE_FILE,
    "[]",
    "utf8"
  );
}

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(express.json({
  limit: "2mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "2mb"
}));

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function cleanName(name) {
  return String(name || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeJsonFile() {
  try {
    const value = fs.readFileSync(
      YOUTUBE_FILE,
      "utf8"
    );

    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch (error) {
    console.error(
      "youtube.json read error:",
      error.message
    );

    return [];
  }
}

function saveYouTubeSongs(songs) {
  fs.writeFileSync(
    YOUTUBE_FILE,
    JSON.stringify(
      songs,
      null,
      2
    ),
    "utf8"
  );
}

function encodeSongPath(relativePath) {
  return relativePath
    .split(path.sep)
    .map(part =>
      encodeURIComponent(part)
    )
    .join("/");
}

function getCategory(relativePath) {
  const parts =
    relativePath.split(path.sep);

  return parts.length > 1
    ? parts[0]
    : "All Songs";
}

function getYouTubeId(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(
      String(value).trim()
    );

    const host =
      url.hostname
        .toLowerCase()
        .replace(/^www\./, "");

    if (host === "youtu.be") {
      return (
        url.pathname
          .replace(/^\/+/, "")
          .split("/")[0] || null
      );
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com"
    ) {
      const video =
        url.searchParams.get("v");

      if (video) {
        return video;
      }

      const match =
        url.pathname.match(
          /^\/(?:shorts|embed|live)\/([^/?]+)/
        );

      return match
        ? match[1]
        : null;
    }

    return null;
  } catch {
    return null;
  }
}

function youtubeUrl(videoId) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(
    videoId
  )}`;
}

function requireAdmin(req, res, next) {
  const suppliedKey =
    req.headers["x-admin-key"] ||
    req.body?.adminKey ||
    req.query?.adminKey;

  if (
    !suppliedKey ||
    suppliedKey !== ADMIN_KEY
  ) {
    return res.status(401).json({
      success: false,
      error: "Invalid admin key"
    });
  }

  next();
}

// --------------------------------------------------
// MP3 scanner
// --------------------------------------------------

function scanLocalSongs() {
  const songs = [];

  function scan(directory) {
    let entries;

    try {
      entries = fs.readdirSync(
        directory,
        {
          withFileTypes: true
        }
      );
    } catch (error) {
      console.error(
        "Directory scan error:",
        error.message
      );
      return;
    }

    for (const entry of entries) {
      const fullPath =
        path.join(
          directory,
          entry.name
        );

      if (entry.isDirectory()) {
        scan(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension =
        path.extname(
          entry.name
        ).toLowerCase();

      if (
        ![
          ".mp3",
          ".m4a",
          ".wav",
          ".ogg",
          ".aac"
        ].includes(extension)
      ) {
        continue;
      }

      const relativePath =
        path.relative(
          SONGS_DIR,
          fullPath
        );

      const category =
        getCategory(
          relativePath
        );

      const encodedPath =
        encodeSongPath(
          relativePath
        );

      songs.push({
        id: `mp3-${songs.length + 1}`,
        source: "mp3",
        type: "mp3",

        title: cleanName(
          entry.name
        ),

        artist: "SwarAJ",

        album: category,

        category,

        filename: entry.name,

        path:
          relativePath.replace(
            /\\/g,
            "/"
          ),

        audio_url:
          `/songs/${encodedPath}`,

        youtube_url: null,

        cover_url:
          "/images/ganpati.jpg"
      });
    }
  }

  scan(SONGS_DIR);

  songs.sort((a, b) =>
    a.title.localeCompare(
      b.title
    )
  );

  return songs.map(
    (song, index) => ({
      ...song,
      id: `mp3-${index + 1}`
    })
  );
}

// --------------------------------------------------
// YouTube songs
// --------------------------------------------------

function getSavedYouTubeSongs() {
  const saved =
    escapeJsonFile();

  return saved.map(
    (song, index) => ({
      ...song,

      id:
        song.id ||
        `youtube-${index + 1}`,

      source: "youtube",

      type: "youtube",

      audio_url: null,

      youtube_url:
        song.youtube_url,

      cover_url:
        song.cover_url ||
        (
          song.video_id
            ? `https://i.ytimg.com/vi/${encodeURIComponent(
                song.video_id
              )}/hqdefault.jpg`
            : null
        )
    })
  );
}

// --------------------------------------------------
// Combined songs
// --------------------------------------------------

function getAllSongs() {
  return [
    ...scanLocalSongs(),
    ...getSavedYouTubeSongs()
  ];
}

// --------------------------------------------------
// Health
// --------------------------------------------------

app.get(
  "/api/health",
  (req, res) => {
    const songs =
      getAllSongs();

    res.json({
      success: true,
      status: "ok",

      message:
        "SwarAJ server is running",

      node:
        process.version,

      mp3Count:
        songs.filter(
          song =>
            song.source === "mp3"
        ).length,

      youtubeCount:
        songs.filter(
          song =>
            song.source === "youtube"
        ).length,

      totalSongs:
        songs.length,

      youtubeApiConfigured:
        Boolean(
          YOUTUBE_API_KEY
        ),

      adminConfigured:
        Boolean(
          process.env.ADMIN_KEY
        ),

      timestamp:
        new Date().toISOString()
    });
  }
);

// --------------------------------------------------
// All songs
// --------------------------------------------------

app.get(
  "/api/songs",
  (req, res) => {
    try {
      const songs =
        getAllSongs();

      res.json({
        success: true,
        count: songs.length,
        songs
      });
    } catch (error) {
      console.error(
        "Songs API error:",
        error
      );

      res.status(500).json({
        success: false,
        count: 0,
        songs: [],
        error:
          error.message
      });
    }
  }
);

// --------------------------------------------------
// Categories
// --------------------------------------------------

app.get(
  "/api/categories",
  (req, res) => {
    const songs =
      getAllSongs();

    const map = {};

    for (const song of songs) {
      const category =
        song.category ||
        "Other";

      if (!map[category]) {
        map[category] = 0;
      }

      map[category]++;
    }

    const categories =
      Object.entries(map)
        .map(
          ([name, count]) => ({
            name,
            count
          })
        )
        .sort(
          (a, b) =>
            a.name.localeCompare(
              b.name
            )
        );

    res.json({
      success: true,
      count:
        categories.length,
      categories
    });
  }
);

// --------------------------------------------------
// YouTube search
// --------------------------------------------------

app.get(
  "/api/youtube/search",
  async (req, res) => {
    const query =
      String(
        req.query.q || ""
      ).trim();

    if (!query) {
      return res.status(400).json({
        success: false,
        error:
          "Search query is required",
        items: []
      });
    }

    if (!YOUTUBE_API_KEY) {
      return res.status(503).json({
        success: false,
        error:
          "YOUTUBE_API_KEY is not configured in Render",
        items: []
      });
    }

    try {
      const params =
        new URLSearchParams({
          part: "snippet",
          q: query,
          type: "video",
          maxResults: "20",
          videoEmbeddable:
            "true",
          key:
            YOUTUBE_API_KEY
        });

      const response =
        await fetch(
          `https://www.googleapis.com/youtube/v3/search?${params}`
        );

      const data =
        await response.json();

      if (!response.ok) {
        console.error(
          "YouTube API:",
          data
        );

        return res.status(
          response.status
        ).json({
          success: false,
          error:
            data?.error?.message ||
            "YouTube API error",
          items: []
        });
      }

      const items =
        (data.items || [])
          .filter(
            item =>
              item.id?.videoId
          )
          .map(item => {
            const videoId =
              item.id.videoId;

            return {
              video_id:
                videoId,

              title:
                item.snippet
                  ?.title ||
                "YouTube Song",

              artist:
                item.snippet
                  ?.channelTitle ||
                "YouTube",

              description:
                item.snippet
                  ?.description ||
                "",

              thumbnail:
                item.snippet
                  ?.thumbnails
                  ?.high
                  ?.url ||
                item.snippet
                  ?.thumbnails
                  ?.default
                  ?.url,

              youtube_url:
                youtubeUrl(
                  videoId
                )
            };
          });

      res.json({
        success: true,
        query,
        count:
          items.length,
        items
      });
    } catch (error) {
      console.error(
        "YouTube search error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          error.message,
        items: []
      });
    }
  }
);

// --------------------------------------------------
// Add YouTube song
// --------------------------------------------------

app.post(
  "/api/youtube",
  requireAdmin,
  (req, res) => {
    const {
      title,
      artist,
      category,
      youtubeUrl:
        submittedUrl,
      youtube_url:
        submittedUrl2
    } = req.body;

    const url =
      submittedUrl ||
      submittedUrl2;

    const videoId =
      getYouTubeId(url);

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid YouTube URL"
      });
    }

    const songs =
      escapeJsonFile();

    const duplicate =
      songs.find(
        song =>
          song.video_id ===
          videoId
      );

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error:
          "This YouTube song is already added"
      });
    }

    const newSong = {
      id:
        `youtube-${Date.now()}`,

      source: "youtube",

      video_id:
        videoId,

      title:
        String(
          title ||
          "YouTube Song"
        ).trim(),

      artist:
        String(
          artist ||
          "YouTube"
        ).trim(),

      category:
        String(
          category ||
          "YouTube"
        ).trim(),

      youtube_url:
        youtubeUrl(
          videoId
        ),

      cover_url:
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,

      created_at:
        new Date().toISOString()
    };

    songs.push(
      newSong
    );

    saveYouTubeSongs(
      songs
    );

    res.status(201).json({
      success: true,
      song: newSong
    });
  }
);

// --------------------------------------------------
// Delete YouTube song
// --------------------------------------------------

app.delete(
  "/api/youtube/:id",
  requireAdmin,
  (req, res) => {
    const id =
      req.params.id;

    const songs =
      escapeJsonFile();

    const before =
      songs.length;

    const filtered =
      songs.filter(
        song =>
          String(song.id) !==
          String(id)
      );

    if (
      filtered.length ===
      before
    ) {
      return res.status(404).json({
        success: false,
        error:
          "YouTube song not found"
      });
    }

    saveYouTubeSongs(
      filtered
    );

    res.json({
      success: true,
      message:
        "YouTube song deleted"
    });
  }
);

// --------------------------------------------------
// Admin status
// --------------------------------------------------

app.get(
  "/api/admin/status",
  requireAdmin,
  (req, res) => {
    res.json({
      success: true,
      admin: true,

      mp3Count:
        scanLocalSongs()
          .length,

      youtubeCount:
        getSavedYouTubeSongs()
          .length
    });
  }
);

// --------------------------------------------------
// Multer storage
// --------------------------------------------------

const storage =
  multer.diskStorage({
    destination:
      (req, file, cb) => {
        const category =
          String(
            req.body.category ||
            "Uncategorized"
          )
            .trim()
            .replace(
              /[^a-zA-Z0-9 _-]/g,
              ""
            );

        const categoryDir =
          path.join(
            SONGS_DIR,
            category ||
              "Uncategorized"
          );

        fs.mkdirSync(
          categoryDir,
          {
            recursive: true
          }
        );

        cb(
          null,
          categoryDir
        );
      },

    filename:
      (req, file, cb) => {
        const original =
          path.basename(
            file.originalname
          );

        const safe =
          original
            .replace(
              /[^a-zA-Z0-9._ -]/g,
              ""
            )
            .replace(
              /\s+/g,
              " "
            )
            .trim();

        cb(
          null,
          `${Date.now()}-${safe || "song.mp3"}`
        );
      }
  });

const upload =
  multer({
    storage,

    limits: {
      fileSize:
        MAX_UPLOAD_SIZE
    },

    fileFilter:
      (req, file, cb) => {
        const extension =
          path.extname(
            file.originalname
          ).toLowerCase();

        if (
          extension !== ".mp3"
        ) {
          return cb(
            new Error(
              "Only MP3 files are allowed"
            )
          );
        }

        cb(
          null,
          true
        );
      }
  });

// --------------------------------------------------
// Upload MP3
// --------------------------------------------------

app.post(
  "/api/admin/upload",
  requireAdmin,
  upload.single("file"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error:
          "No MP3 file selected"
      });
    }

    const relativePath =
      path.relative(
        SONGS_DIR,
        req.file.path
      );

    const song = {
      source: "mp3",

      title:
        String(
          req.body.title ||
          cleanName(
            req.file.originalname
          )
        ).trim(),

      artist:
        String(
          req.body.artist ||
          "SwarAJ"
        ).trim(),

      category:
        String(
          req.body.category ||
          "Uncategorized"
        ).trim(),

      path:
        relativePath.replace(
          /\\/g,
          "/"
        ),

      audio_url:
        `/songs/${encodeSongPath(
          relativePath
        )}`
    };

    res.status(201).json({
      success: true,
      message:
        "MP3 uploaded successfully",
      song
    });
  }
);

// --------------------------------------------------
// Delete local MP3
// --------------------------------------------------

app.delete(
  "/api/admin/mp3",
  requireAdmin,
  (req, res) => {
    const requestedPath =
      String(
        req.body.path ||
        ""
      ).trim();

    if (!requestedPath) {
      return res.status(400).json({
        success: false,
        error:
          "Song path is required"
      });
    }

    const absolute =
      path.resolve(
        SONGS_DIR,
        requestedPath
      );

    const songsRoot =
      path.resolve(
        SONGS_DIR
      );

    if (
      !absolute.startsWith(
        songsRoot + path.sep
      )
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid song path"
      });
    }

    if (
      !fs.existsSync(
        absolute
      )
    ) {
      return res.status(404).json({
        success: false,
        error:
          "MP3 file not found"
      });
    }

    fs.unlinkSync(
      absolute
    );

    res.json({
      success: true,
      message:
        "MP3 deleted successfully"
    });
  }
);

// --------------------------------------------------
// Serve songs
// --------------------------------------------------

app.use(
  "/songs",
  express.static(
    SONGS_DIR,
    {
      setHeaders:
        (res, filePath) => {
          const extension =
            path.extname(
              filePath
            ).toLowerCase();

          const types = {
            ".mp3":
              "audio/mpeg",
            ".m4a":
              "audio/mp4",
            ".wav":
              "audio/wav",
            ".ogg":
              "audio/ogg",
            ".aac":
              "audio/aac"
          };

          if (
            types[extension]
          ) {
            res.setHeader(
              "Content-Type",
              types[extension]
            );
          }

          res.setHeader(
            "Accept-Ranges",
            "bytes"
          );

          res.setHeader(
            "Cache-Control",
            "public, max-age=3600"
          );
        }
    }
  )
);

// --------------------------------------------------
// Images
// --------------------------------------------------

if (
  fs.existsSync(
    IMAGES_DIR
  )
) {
  app.use(
    "/images",
    express.static(
      IMAGES_DIR
    )
  );
}

// --------------------------------------------------
// Frontend
// --------------------------------------------------

app.use(
  express.static(
    ROOT_DIR,
    {
      index:
        "index.html"
    }
  )
);

// --------------------------------------------------
// Express 5 fallback
// --------------------------------------------------

app.use(
  (req, res) => {
    const indexFile =
      path.join(
        ROOT_DIR,
        "index.html"
      );

    if (
      fs.existsSync(
        indexFile
      )
    ) {
      return res.sendFile(
        indexFile
      );
    }

    res.status(404).json({
      success: false,
      error:
        "index.html not found"
    });
  }
);

// --------------------------------------------------
// Error handler
// --------------------------------------------------

app.use(
  (err, req, res, next) => {
    console.error(
      "SERVER ERROR:",
      err
    );

    if (
      err instanceof
      multer.MulterError
    ) {
      return res.status(400).json({
        success: false,
        error:
          err.message
      });
    }

    res.status(500).json({
      success: false,
      error:
        err.message ||
        "Internal server error"
    });
  }
);

// --------------------------------------------------
// Start
// --------------------------------------------------

app.listen(
  PORT,
  HOST,
  () => {
    const songs =
      getAllSongs();

    console.log(
      "===================================="
    );

    console.log(
      "        SwarAJ Music Server"
    );

    console.log(
      "===================================="
    );

    console.log(
      `Server: http://${HOST}:${PORT}`
    );

    console.log(
      `MP3 songs: ${
        songs.filter(
          s =>
            s.source === "mp3"
        ).length
      }`
    );

    console.log(
      `YouTube songs: ${
        songs.filter(
          s =>
            s.source === "youtube"
        ).length
      }`
    );

    console.log(
      `YouTube API: ${
        YOUTUBE_API_KEY
          ? "configured"
          : "NOT CONFIGURED"
      }`
    );

    console.log(
      `Admin key: ${
        process.env.ADMIN_KEY
          ? "configured"
          : "using default"
      }`
    );

    console.log(
      "===================================="
    );
  }
);