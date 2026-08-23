# स्वरAJ Music Website

A mobile-first music streaming UI with automatic song scanning.

## Run locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Add your music

Put legally owned, licensed, public-domain, or creator-permitted audio inside:

```text
songs/
  Bhakti/
  Love/
  Marathi/
  Energetic/
```

The first folder becomes the category automatically. Nested folders are supported.

## Render

Create a new Web Service from this project.

Build command:

```text
npm install
```

Start command:

```text
npm start
```

No database or environment variables are required for the basic version.

## API

- `/api/health`
- `/api/songs`
- `/api/categories`
- `/api/search?q=love`

## Important

The included demo audio is synthetic test audio created for this project. Replace it with audio you are legally allowed to host.