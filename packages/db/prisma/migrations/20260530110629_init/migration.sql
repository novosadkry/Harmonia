-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "discriminator" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "spotifyUri" TEXT,
    "userOverrideYoutubeVideoId" TEXT,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "album" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "thumbnailUrl" TEXT,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "firstAddedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "shareCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaylistTrack" (
    "playlistId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistTrack_pkey" PRIMARY KEY ("playlistId","trackId")
);

-- CreateTable
CREATE TABLE "SearchCache" (
    "queryHash" TEXT NOT NULL,
    "queryRaw" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "lastSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchCache_pkey" PRIMARY KEY ("queryHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "Track_youtubeVideoId_key" ON "Track"("youtubeVideoId");

-- CreateIndex
CREATE UNIQUE INDEX "Track_spotifyUri_key" ON "Track"("spotifyUri");

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_shareCode_key" ON "Playlist"("shareCode");

-- CreateIndex
CREATE INDEX "PlaylistTrack_playlistId_position_idx" ON "PlaylistTrack"("playlistId", "position");

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_firstAddedBy_fkey" FOREIGN KEY ("firstAddedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
