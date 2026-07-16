export type YouTubeTarget =
  | {
      kind: "video";
      videoId: string;
      originalUrl: string;
    }
  | {
      kind: "external";
      originalUrl: string;
    };

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export const isValidYouTubeVideoId = (value: string) =>
  YOUTUBE_VIDEO_ID_PATTERN.test(value);

const externalTarget = (originalUrl: string): YouTubeTarget => ({
  kind: "external",
  originalUrl,
});

const videoTarget = (videoId: string, originalUrl: string): YouTubeTarget =>
  isValidYouTubeVideoId(videoId)
    ? { kind: "video", videoId, originalUrl }
    : externalTarget(originalUrl);

export function resolveYouTubeTarget(input: string): YouTubeTarget {
  const originalUrl = input;
  const trimmed = input.trim();
  if (isValidYouTubeVideoId(trimmed)) return videoTarget(trimmed, originalUrl);

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return externalTarget(originalUrl);
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") {
    const [videoId] = url.pathname.split("/").filter(Boolean);
    return videoId ? videoTarget(videoId, originalUrl) : externalTarget(originalUrl);
  }

  if (host !== "youtube.com" && host !== "m.youtube.com") {
    return externalTarget(originalUrl);
  }

  const watchVideoId = url.searchParams.get("v");
  if (watchVideoId) return videoTarget(watchVideoId, originalUrl);

  const [kind, videoId] = url.pathname.split("/").filter(Boolean);
  if ((kind === "shorts" || kind === "embed") && videoId) {
    return videoTarget(videoId, originalUrl);
  }

  return externalTarget(originalUrl);
}

export function buildYouTubeEmbedUrl(videoId: string): string {
  const params = new URLSearchParams({
    playsinline: "1",
    autoplay: "1",
  });

  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
    videoId
  )}?${params.toString()}`;
}
