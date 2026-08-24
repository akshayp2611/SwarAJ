const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const SONGS_DIR = path.join(ROOT, "songs");
const IMAGES_DIR = path.join(ROOT, "images");
const DATA_DIR = path.join(ROOT, "data");
const CATALOG_FILE = path.join(DATA_DIR, "songs.json");

const ADMIN_KEY = process.env.ADMIN_KEY || "swaraj-admin";

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".flac",
  ".webm"
]);

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif"
]);

app.disable("x-powered-by");

app.use(express.json({
  limit: "120mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "120mb"
}));

for (const dir of [
  SONGS_DIR,
  IMAGES_DIR,
  DATA_DIR
]) {
  fs.mkdirSync(dir, {
    recursive: true
  });
}

/* =========================
   HELPERS
========================= */

function clean(value) {
  return String(value ?? "").trim();
}

function safeFileName(value) {
  return clean(value)
    .replace(/[^a-zA-Z0-9._ -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanName(filename) {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function encodePath(parts) {
  return parts
    .map(part => encodeURIComponent(part))
    .join("/");
}

/* =========================
   YOUTUBE
========================= */

function youtubeId(url) {
  const value = clean(url);

  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/i,
    /youtube\.com\/watch\?[^#]*v=([A-Za-z0-9_-]{11})/i,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/i,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/i,
    /youtube\.com\/live\/([A-Za-z0-9_-]{11})/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (match) {
      return match[1];
    }
  }

  return null;
}

/* =========================
   CATALOG
========================= */

function readCatalog() {
  try {
    if (!fs.existsSync(CATALOG_FILE)) {
      return [];
    }

    const data = JSON.parse(
      fs.readFileSync(
        CATALOG_FILE,
        "utf8"
      )
    );

    return Array.isArray(data)
      ? data
      : [];

  } catch (error) {
    console.error(
      "Catalog read error:",
      error.message
    );

    return [];
  }
}

function writeCatalog(items) {
  fs.writeFileSync(
    CATALOG_FILE,
    JSON.stringify(
      items,
      null,
      2
    ),
    "utf8"
  );
}

/* =========================
   COVER
========================= */

function findCover(category) {
  const names = [
    category,
    category.toLowerCase(),
    category.replace(/\s+/g, "-"),
    "default",
    "ganpati"
  ];

  for (const name of names) {
    for (const extension of IMAGE_EXTENSIONS) {

      const file = path.join(
        IMAGES_DIR,
        name + extension
      );

      if (fs.existsSync(file)) {
        return file;
      }
    }
  }

  try {

    const file =
      fs.readdirSync(IMAGES_DIR)
        .find(file =>
          IMAGE_EXTENSIONS.has(
            path.extname(file)
              .toLowerCase()
          )
        );

    return file
      ? path.join(IMAGES_DIR, file)
      : null;

  } catch {
    return null;
  }
}

/* =========================
   SCAN MP3
========================= */

function scanLocalSongs() {

  const songs = [];

  function walk(directory) {

    let entries = [];

    try {

      entries =
        fs.readdirSync(
          directory,
          {
            withFileTypes: true
          }
        );

    } catch {
      return;
    }

    for (const entry of entries) {

      const absolutePath =
        path.join(
          directory,
          entry.name
        );

      if (entry.isDirectory()) {

        walk(absolutePath);

        continue;
      }

      const extension =
        path.extname(
          entry.name
        ).toLowerCase();

      if (
        !AUDIO_EXTENSIONS.has(
          extension
        )
      ) {
        continue;
      }

      const relativePath =
        path.relative(
          SONGS_DIR,
          absolutePath
        );

      const parts =
        relativePath.split(
          path.sep
        );

      const category =
        parts.length > 1
          ? cleanName(parts[0])
          : "All Songs";

      let stats = null;

      try {
        stats =
          fs.statSync(
            absolutePath
          );
      } catch {}

      songs.push({

        id:
          `mp3:${relativePath}`,

        source:
          "mp3",

        type:
          "mp3",

        title:
          cleanName(entry.name),

        artist:
          "स्वरAJ",

        category,

        filename:
          entry.name,

        extension:
          extension.substring(1),

        size:
          stats
            ? stats.size
            : 0,

        url:
          "/songs/" +
          encodePath(parts),

        cover:
          "/api/cover/" +
          encodeURIComponent(
            category
          )

      });
    }
  }

  walk(SONGS_DIR);

  return songs;
}

/* =========================
   ALL SONGS
========================= */

function getSongs() {

  const localSongs =
    scanLocalSongs();

  const catalog =
    readCatalog()
      .map(song => ({

        ...song,

        source:
          song.source ||
          (
            song.youtube_url
              ? "youtube"
              : "mp3"
          ),

        type:
          song.type ||
          (
            song.youtube_url
              ? "youtube"
              : "mp3"
          ),

        cover:
          song.cover ||
          (
            "/api/cover/" +
            encodeURIComponent(
              song.category ||
              "All Songs"
            )
          )

      }));

  const localIds =
    new Set(
      localSongs.map(
        song => song.id
      )
    );

  return [
    ...catalog.filter(
      song =>
        !localIds.has(
          song.id
        )
    ),
    ...localSongs
  ].sort(
    (a, b) =>
      String(a.title)
        .localeCompare(
          String(b.title),
          undefined,
          {
            numeric: true,
            sensitivity: "base"
          }
        )
  );
}

/* =========================
   ADMIN AUTH
========================= */

function requireAdmin(
  req,
  res,
  next
) {

  const suppliedKey =
    clean(
      req.headers["x-admin-key"] ||
      req.body?.adminKey ||
      req.query?.adminKey
    );

  if (
    suppliedKey !==
    ADMIN_KEY
  ) {

    return res.status(401).json({
      success: false,
      error: "Invalid admin key"
    });
  }

  next();
}

/* =========================
   HEALTH
========================= */

app.get(
  "/api/health",
  (req, res) => {

    const songs =
      getSongs();

    res.json({

      success: true,

      status: "ok",

      service:
        "स्वरAJ",

      songCount:
        songs.length,

      mp3Count:
        songs.filter(
          s =>
            s.source === "mp3"
        ).length,

      youtubeCount:
        songs.filter(
          s =>
            s.source === "youtube"
        ).length,

      timestamp:
        new Date()
          .toISOString()

    });
  }
);

/* =========================
   SONG API
========================= */

app.get(
  "/api/songs",
  (req, res) => {

    try {

      const songs =
        getSongs();

      res.json({

        success: true,

        count:
          songs.length,

        songs

      });

    } catch (error) {

      console.error(
        "Song scan failed:",
        error
      );

      res.status(500).json({

        success: false,

        count: 0,

        songs: [],

        error:
          "Unable to load songs"

      });
    }
  }
);

/* =========================
   CATEGORIES
========================= */

app.get(
  "/api/categories",
  (req, res) => {

    const map =
      new Map();

    for (
      const song
      of getSongs()
    ) {

      const name =
        song.category ||
        "All Songs";

      if (
        !map.has(name)
      ) {

        map.set(
          name,
          {
            name,
            count: 0,
            cover:
              "/api/cover/" +
              encodeURIComponent(
                name
              )
          }
        );
      }

      map.get(name).count++;
    }

    res.json({

      success: true,

      count:
        map.size,

      categories:
        Array.from(
          map.values()
        ).sort(
          (a, b) =>
            a.name.localeCompare(
              b.name
            )
        )

    });
  }
);

/* =========================
   SEARCH
========================= */

app.get(
  "/api/search",
  (req, res) => {

    const query =
      clean(
        req.query.q
      ).toLowerCase();

    const songs =
      getSongs()
        .filter(song => {

          if (!query) {
            return true;
          }

          return [
            song.title,
            song.artist,
            song.category,
            song.filename,
            song.source
          ].some(
            value =>
              String(
                value || ""
              )
                .toLowerCase()
                .includes(query)
          );
        });

    res.json({

      success: true,

      count:
        songs.length,

      songs

    });
  }
);

/* =========================
   COVER
========================= */

app.get(
  "/api/cover/:category",
  (req, res) => {

    const category =
      decodeURIComponent(
        req.params.category ||
        ""
      );

    const cover =
      findCover(
        category
      );

    if (!cover) {
      return res
        .status(404)
        .send(
          "Cover not found"
        );
    }

    res.sendFile(
      cover
    );
  }
);

/* =========================
   ADMIN - YOUTUBE
========================= */

app.post(
  "/api/admin/youtube",
  requireAdmin,
  (req, res) => {

    try {

      const title =
        clean(
          req.body.title
        ) ||
        "YouTube Song";

      const artist =
        clean(
          req.body.artist
        ) ||
        "स्वरAJ";

      const category =
        clean(
          req.body.category
        ) ||
        "YouTube";

      const youtubeUrl =
        clean(
          req.body.youtubeUrl ||
          req.body.youtube_url
        );

      const id =
        youtubeId(
          youtubeUrl
        );

      if (!id) {

        return res.status(400).json({

          success: false,

          error:
            "Enter a valid YouTube URL"

        });
      }

      const items =
        readCatalog();

      const song = {

        id:
          `youtube:${id}`,

        source:
          "youtube",

        type:
          "youtube",

        title,

        artist,

        category,

        youtube_url:
          youtubeUrl,

        youtube_id:
          id,

        cover:
          clean(
            req.body.cover
          ) ||
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,

        createdAt:
          new Date()
            .toISOString()

      };

      const index =
        items.findIndex(
          item =>
            item.id ===
            song.id
        );

      if (index >= 0) {

        items[index] = {
          ...items[index],
          ...song
        };

      } else {

        items.push(song);

      }

      writeCatalog(
        items
      );

      res.json({

        success: true,

        song

      });

    } catch (error) {

      console.error(
        "ADD YOUTUBE ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        error:
          error.message

      });
    }
  }
);

/* =========================
   ADMIN - MP3
========================= */

app.post(
  "/api/admin/mp3",
  requireAdmin,
  (req, res) => {

    try {

      const filename =
        safeFileName(
          req.body.filename
        );

      const dataUrl =
        clean(
          req.body.data
        );

      const category =
        clean(
          req.body.category
        ) ||
        "Uploads";

      const artist =
        clean(
          req.body.artist
        ) ||
        "स्वरAJ";

      const title =
        clean(
          req.body.title
        ) ||
        cleanName(
          filename
        );

      if (
        !filename ||
        !dataUrl.startsWith(
          "data:audio/"
        )
      ) {

        return res.status(400).json({

          success: false,

          error:
            "MP3 file data is missing"

        });
      }

      if (
        path.extname(
          filename
        ).toLowerCase() !==
        ".mp3"
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Only MP3 upload is supported"

        });
      }

      const match =
        dataUrl.match(
          /^data:audio\/[^;]+;base64,(.+)$/
        );

      if (!match) {

        return res.status(400).json({

          success: false,

          error:
            "Invalid MP3 data"

        });
      }

      const safeCategory =
        safeFileName(
          category
        ) ||
        "Uploads";

      const directory =
        path.join(
          SONGS_DIR,
          safeCategory
        );

      fs.mkdirSync(
        directory,
        {
          recursive: true
        }
      );

      const finalName =
        `${Date.now()}-${filename}`;

      const absolutePath =
        path.join(
          directory,
          finalName
        );

      fs.writeFileSync(
        absolutePath,
        Buffer.from(
          match[1],
          "base64"
        )
      );

      res.json({

        success: true,

        message:
          "MP3 uploaded",

        song: {

          title,

          artist,

          category:

            safeCategory,

          source:
            "mp3",

          url:
            `/songs/${encodeURIComponent(
              safeCategory
            )}/${encodeURIComponent(
              finalName
            )}`

        }

      });

    } catch (error) {

      console.error(
        "ADD MP3 ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        error:
          error.message

      });
    }
  }
);

/* =========================
   DELETE YOUTUBE
========================= */

app.delete(
  "/api/admin/youtube/:id",
  requireAdmin,
  (req, res) => {

    const items =
      readCatalog();

    const id =
      `youtube:${clean(
        req.params.id
      )}`;

    const next =
      items.filter(
        item =>
          item.id !== id
      );

    writeCatalog(
      next
    );

    res.json({

      success: true,

      removed:
        items.length -
        next.length

    });
  }
);

/* =========================
   STATIC
========================= */

app.use(
  "/songs",
  express.static(
    SONGS_DIR,
    {
      fallthrough: false,

      setHeaders: res => {

        res.setHeader(
          "Accept-Ranges",
          "bytes"
        );

        res.setHeader(
          "Cache-Control",
          "public,max-age=31536000"
        );
      }
    }
  )
);

app.use(
  "/images",
  express.static(
    IMAGES_DIR,
    {
      maxAge: "7d"
    }
  )
);

app.use(
  express.static(
    ROOT,
    {
      extensions: ["html"]
    }
  )
);

/* =========================
   SPA
========================= */

app.get(
  "*",
  (req, res) => {

    if (
      req.path.startsWith(
        "/api/"
      ) ||
      req.path.startsWith(
        "/songs/"
      ) ||
      req.path.startsWith(
        "/images/"
      )
    ) {

      return res
        .status(404)
        .json({
          error:
            "Not found"
        });
    }

    res.sendFile(
      path.join(
        ROOT,
        "index.html"
      )
    );
  }
);

/* =========================
   ERROR
========================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      "SERVER ERROR:",
      error
    );

    if (
      res.headersSent
    ) {
      return next(
        error
      );
    }

    res.status(500).json({

      success: false,

      error:
        "Internal server error"

    });
  }
);

/* =========================
   START
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    const songs =
      getSongs();

    console.log(
      `स्वरAJ server running on ${PORT}`
    );

    console.log(
      `MP3: ${
        songs.filter(
          s =>
            s.source === "mp3"
        ).length
      }`
    );

    console.log(
      `YouTube: ${
        songs.filter(
          s =>
            s.source === "youtube"
        ).length
      }`
    );
  }
);