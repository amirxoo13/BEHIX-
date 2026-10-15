import { Input, ALL_FORMATS, BlobSource } from "mediabunny";
export async function inspectVideo(blob: Blob) {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
  try {
    const video = await input.getPrimaryVideoTrack();
    return {
      duration: await input.computeDuration(),
      width: video?.displayWidth,
      height: video?.displayHeight,
      audio: (await input.getAudioTracks()).length,
      codec: video?.codec,
    };
  } finally {
    input.dispose();
  }
}
