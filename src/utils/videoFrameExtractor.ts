/**
 * Utility to extract representative video frames from a File or Video URL
 * using an offscreen HTMLVideoElement and Canvas.
 */

export interface ExtractedFrame {
  time: number;
  data: string; // base64 data URL
}

export async function extractFramesFromVideo(
  videoSource: File | string,
  frameCount: number = 3,
  onProgress?: (progress: number) => void
): Promise<{ frames: ExtractedFrame[]; duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    let objectUrl: string | null = null;
    if (typeof videoSource === 'string') {
      video.src = videoSource;
    } else {
      objectUrl = URL.createObjectURL(videoSource);
      video.src = objectUrl;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const cleanUp = () => {
      video.remove();
      canvas.remove();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };

    video.onloadedmetadata = async () => {
      const duration = video.duration || 10;
      const width = video.videoWidth || 360;
      const height = video.videoHeight || 200;

      // Ultra-optimized 360px resolution & 0.6 JPEG compression (< 30KB per frame)
      const targetWidth = 360;
      const targetHeight = Math.round((height / width) * 360) || 200;
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const timestamps: number[] = [];
      const step = duration / (frameCount + 1);
      for (let i = 1; i <= frameCount; i++) {
        timestamps.push(Math.min(duration - 0.1, Math.max(0.1, i * step)));
      }

      const frames: ExtractedFrame[] = [];

      try {
        for (let i = 0; i < timestamps.length; i++) {
          const t = timestamps[i];
          await seekToTime(video, t);
          if (ctx) {
            ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            frames.push({ time: t, data: dataUrl });
          }
          if (onProgress) {
            onProgress(Math.round(((i + 1) / timestamps.length) * 100));
          }
        }
        cleanUp();
        resolve({ frames, duration, width, height });
      } catch (err) {
        cleanUp();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanUp();
      reject(new Error('Не удалось загрузить или декодировать видеофайл.'));
    };

    setTimeout(() => {
      if (video.readyState === 0) {
        cleanUp();
        reject(new Error('Превышено время ожидания загрузки метаданных видео.'));
      }
    }, 15000);
  });
}

function seekToTime(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;

    const onSeeked = () => {
      if (!resolved) {
        resolved = true;
        video.removeEventListener('seeked', onSeeked);
        resolve();
      }
    };

    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        video.removeEventListener('seeked', onSeeked);
        resolve();
      }
    }, 1200);
  });
}
