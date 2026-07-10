/**
 * Extract evenly spaced JPEG frames from a recorded video blob (client-side).
 */

export type FrameExtractionPhase = "loading" | "extracting" | "done" | "error";

export type FrameExtractionProgress = {
  phase: FrameExtractionPhase;
  current: number;
  total: number;
  message?: string;
};

export type ExtractFramesOptions = {
  frameCount?: number;
  jpegQuality?: number;
  maxWidth?: number;
  timeoutMs?: number;
  seekRetries?: number;
  onProgress?: (progress: FrameExtractionProgress) => void;
};

const DEFAULTS = {
  frameCount: 5,
  jpegQuality: 0.82,
  maxWidth: 768,
  timeoutMs: 30_000,
  seekRetries: 2,
} as const;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function loadVideoMetadata(objectUrl: string, timeoutMs: number): Promise<HTMLVideoElement> {
  return withTimeout(
    new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        if (!video.videoWidth || !video.videoHeight) {
          reject(new Error("Invalid video dimensions"));
          return;
        }
        if (!video.duration || !Number.isFinite(video.duration)) {
          reject(new Error("Video has no duration"));
          return;
        }
        resolve(video);
      };

      video.onerror = () => reject(new Error("Failed to load video"));
      video.src = objectUrl;
    }),
    timeoutMs,
    "Video loading timed out"
  );
}

async function seekTo(video: HTMLVideoElement, time: number, seekRetries: number): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= seekRetries; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onSeeked = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error("Seek failed"));
        };
        const cleanup = () => {
          video.removeEventListener("seeked", onSeeked);
          video.removeEventListener("error", onError);
        };

        video.addEventListener("seeked", onSeeked);
        video.addEventListener("error", onError);
        video.currentTime = Math.min(Math.max(time, 0), Math.max(video.duration - 0.05, 0));
      });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Seek failed");
      await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error("Seek failed");
}

function captureFrame(
  video: HTMLVideoElement,
  ctx: CanvasRenderingContext2D,
  maxWidth: number,
  jpegQuality: number
): string {
  const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
  const width = Math.round(video.videoWidth * scale);
  const height = Math.round(video.videoHeight * scale);

  canvasSize(ctx.canvas, width, height);
  ctx.drawImage(video, 0, 0, width, height);

  const dataUrl = ctx.canvas.toDataURL("image/jpeg", jpegQuality);
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("Failed to encode frame");
  return base64;
}

function canvasSize(canvas: HTMLCanvasElement, width: number, height: number) {
  canvas.width = width;
  canvas.height = height;
}

export async function extractFramesFromVideo(
  videoBlob: Blob,
  options: ExtractFramesOptions = {}
): Promise<string[]> {
  const frameCount = options.frameCount ?? DEFAULTS.frameCount;
  const jpegQuality = options.jpegQuality ?? DEFAULTS.jpegQuality;
  const maxWidth = options.maxWidth ?? DEFAULTS.maxWidth;
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const seekRetries = options.seekRetries ?? DEFAULTS.seekRetries;
  const onProgress = options.onProgress;

  if (!videoBlob.size) {
    throw new Error("Video blob is empty");
  }

  const objectUrl = URL.createObjectURL(videoBlob);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Could not get canvas context");
  }

  onProgress?.({ phase: "loading", current: 0, total: frameCount, message: "Loading video…" });

  try {
    const video = await loadVideoMetadata(objectUrl, timeoutMs);
    const frames: string[] = [];

    for (let i = 0; i < frameCount; i++) {
      onProgress?.({
        phase: "extracting",
        current: i,
        total: frameCount,
        message: `Extracting frame ${i + 1}/${frameCount}`,
      });

      const time = frameCount === 1 ? 0 : (i / (frameCount - 1)) * video.duration * 0.95;
      await seekTo(video, time, seekRetries);
      frames.push(captureFrame(video, ctx, maxWidth, jpegQuality));

      onProgress?.({
        phase: "extracting",
        current: i + 1,
        total: frameCount,
        message: `Extracting frame ${i + 1}/${frameCount}`,
      });
    }

    onProgress?.({ phase: "done", current: frameCount, total: frameCount });
    return frames;
  } catch (error) {
    onProgress?.({
      phase: "error",
      current: 0,
      total: frameCount,
      message: error instanceof Error ? error.message : "Frame extraction failed",
    });
    throw error;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
