// Speech-to-text endpoint. Provider-agnostic by design:
//   - If GROQ_API_KEY is set  -> Groq Whisper-large-v3-turbo (true ASR: never
//     refuses, handles one-word clips, stellar accuracy).
//   - Else if OPENROUTER_API_KEY -> hardened gpt-audio (chat model forced into
//     strict transcription mode, with refusals filtered to empty server-side).
// Adding a (free) Groq key auto-upgrades quality with zero code changes.

export const maxDuration = 60;

const SYSTEM_PROMPT =
  "You are an automatic speech-recognition engine. Output ONLY a verbatim, " +
  "word-for-word transcription of the user's audio. Do not translate, " +
  "summarise, explain, greet, apologise, or ask questions. Never address the " +
  "user. Preserve every name, number, quantity, and product term exactly. If " +
  "the audio contains no intelligible speech, output exactly: [INAUDIBLE]";

// Phrases a chat model emits when it refuses / has no audio. Any of these means
// "no usable transcription" -> collapse to empty so nothing leaks to the UI.
const REFUSAL_RE =
  /(play the audio|provide the audio|share the audio|upload the audio|no audio|cannot hear|can'?t hear|unable to (hear|transcribe|process)|i'?m sorry|as an ai|i (will|can) (provide|transcribe)|please (provide|share|upload|play))/i;

function cleanTranscript(raw: unknown): string {
  let t = "";
  if (typeof raw === "string") t = raw;
  else if (Array.isArray(raw)) t = raw.map((p) => (p && typeof p === "object" && "text" in p ? (p as { text?: string }).text || "" : "")).join(" ");
  t = t.trim();
  if (!t) return "";
  if (/\[inaudible\]/i.test(t)) return "";
  if (REFUSAL_RE.test(t)) return "";
  return t.replace(/^["']+|["']+$/g, "").trim();
}

async function transcribeWithGroq(audioB64: string, format: string, key: string) {
  const bytes = Buffer.from(audioB64, "base64");
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: `audio/${format}` }), `audio.${format}`);
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "json");
  form.append("language", "en");
  form.append("temperature", "0");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    console.error("Groq STT failed:", res.status, await res.text());
    return Response.json({ text: "" });
  }
  const data = await res.json();
  return Response.json({ text: cleanTranscript(data.text) });
}

async function transcribeWithGptAudio(audioB64: string, format: string, key: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://jr-property-cleanup.vercel.app",
    },
    body: JSON.stringify({
      model: "openai/gpt-audio",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe the following audio verbatim." },
            { type: "input_audio", input_audio: { data: audioB64, format } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    console.error("gpt-audio STT failed:", res.status, await res.text());
    return Response.json({ text: "" });
  }
  const data = await res.json();
  return Response.json({ text: cleanTranscript(data.choices?.[0]?.message?.content) });
}

export async function POST(request: Request) {
  const { audio, format = "wav" } = await request.json();

  if (!audio) {
    return Response.json({ error: "No audio data" }, { status: 400 });
  }

  const groqKey = (process.env.GROQ_API_KEY || "").trim();
  if (groqKey) return transcribeWithGroq(audio, format, groqKey);

  const orKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (orKey) return transcribeWithGptAudio(audio, format, orKey);

  // No provider configured (e.g. local dev without keys).
  return Response.json({ text: "" });
}
