import { renderVoiceBuffer } from "./voice";

/**
 * A real spoken recording for the "Speech" source: the Gettysburg Address,
 * read by Britton, public domain on Wikimedia Commons (served with CORS).
 * The MP3 transcode plays in every browser; the original is OGG.
 * If the network is unavailable the synthesised voice stands in.
 */
export const SPEECH_URL =
  "https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a1/Gettysburg_by_Britton.ogg/Gettysburg_by_Britton.ogg.mp3";

let cached: Promise<AudioBuffer> | null = null;

export function loadSpeech(ctx: AudioContext): Promise<AudioBuffer> {
  cached ??= fetch(SPEECH_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`speech sample: HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then((bytes) => ctx.decodeAudioData(bytes))
    .catch((e) => {
      console.warn("speech sample unavailable, using the synthesised voice", e);
      return renderVoiceBuffer();
    });
  return cached;
}
