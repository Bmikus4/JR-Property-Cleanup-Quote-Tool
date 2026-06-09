"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { randomTestQuote } from "../lib/testQuotes";


interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string; // thumbnail for photo messages
}

type ConfirmState = "idle" | "confirmed" | "sent";
type InputMode = null | "sequential" | "bulk";

interface ChatScreenProps {
  onBack?: () => void;
  isActive: boolean;
  adminControls?: boolean;
}

interface DraftData {
  messages: Message[];
  mode: InputMode;
  confirmState: "idle" | "confirmed";
  savedAt: number;
}

const DRAFT_TTL_MS = 30 * 60 * 1000;

function getDraftKey(): string | null {
  try {
    const stored = localStorage.getItem("auth");
    if (!stored) return null;
    const { email } = JSON.parse(stored);
    return email ? `quote-draft-${email}` : null;
  } catch { return null; }
}

function saveDraft(messages: Message[], mode: InputMode, confirmState: ConfirmState, isStreaming: boolean) {
  const key = getDraftKey();
  if (!key) return;
  if (confirmState === "sent") {
    localStorage.removeItem(key);
    return;
  }
  const completeMsgs = isStreaming ? messages.slice(0, -1) : messages;
  if (completeMsgs.length === 0) return;
  const draft: DraftData = {
    messages: completeMsgs,
    mode,
    confirmState: confirmState === "confirmed" ? "confirmed" : "idle",
    savedAt: Date.now(),
  };
  try { localStorage.setItem(key, JSON.stringify(draft)); } catch { /* quota */ }
}

function loadDraft(): DraftData | null {
  const key = getDraftKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft: DraftData = JSON.parse(raw);
    if (draft.confirmState === "sent" as string) {
      localStorage.removeItem(key);
      return null;
    }
    if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    if (!draft.messages || draft.messages.length <= 1) return null;
    return draft;
  } catch {
    return null;
  }
}

function clearDraft() {
  const key = getDraftKey();
  if (key) localStorage.removeItem(key);
}

function isQuoteComplete(content: string): boolean {
  // Detect the JR property cleanup quote format
  return (content.includes("JR PROPERTY CLEANUP") && content.includes("TOTAL:")) ||
    // Legacy format (kept for backward compatibility)
    (content.includes("Quote:") && content.includes("Items:"));
}

function extractActions(content: string): string[] {
  const match = content.match(/\[ACTIONS:\s*(.+?)\]\s*$/);
  if (!match) return [];
  return match[1].split("|").map((s) => s.trim()).filter(Boolean);
}

function stripActions(content: string): string {
  return content
    .replace(/\n?\[ACTIONS:\s*.+?\]\s*$/, "")
    // The model emits [QUOTE_COMPLETE] as a control marker; never show it.
    .replace(/\s*\[QUOTE_COMPLETE\]\s*/g, "")
    .trimEnd();
}

function renderMessage(content: string): React.ReactNode[] {
  const cleaned = stripActions(content);
  const lines = cleaned.split("\n");

  return lines.map((line, li) => {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let last = 0;
    let match;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > last) parts.push(line.slice(last, match.index));
      parts.push(<strong key={`${li}-${match.index}`}>{match[1]}</strong>);
      last = regex.lastIndex;
    }
    if (last < line.length) parts.push(line.slice(last));

    return (
      <span key={li}>
        {parts}
        {li < lines.length - 1 && "\n"}
      </span>
    );
  });
}

// Linear-resample mono PCM from srcRate down to dstRate.
function downsample(samples: Float32Array, srcRate: number, dstRate: number): Float32Array {
  if (dstRate >= srcRate) return samples;
  const ratio = srcRate / dstRate;
  const newLen = Math.floor(samples.length / ratio);
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const frac = idx - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}

// Encode raw mono PCM (captured straight off the audio graph) as 16 kHz mono
// 16-bit WAV — the format dedicated speech models (gpt-audio, Whisper) expect.
// Returns raw base64 (no data-URL prefix). Capturing PCM directly avoids the
// browser's webm/opus container, which decodeAudioData can't reliably decode —
// that round-trip was silently failing and dropping transcriptions.
function pcmToWavBase64(pcm: Float32Array, srcRate: number): string {
  const targetRate = 16000;
  const samples = downsample(pcm, srcRate, targetRate);
  const dataSize = samples.length * 2;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);            // fmt chunk size
  view.setUint16(20, 1, true);             // PCM
  view.setUint16(22, 1, true);             // mono
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true); // byte rate
  view.setUint16(32, 2, true);             // block align
  view.setUint16(34, 16, true);            // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(ab);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Parse the model's "#  | Item | Size" rows out of a quote message.
function parseQuoteRows(content: string): { name: string; size: string }[] {
  const rows: { name: string; size: string }[] = [];
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (/^#/.test(t)) continue; // skip the "# | Item | Size" header
    const m = t.match(/^\d+\s*\|\s*(.+?)\s*\|\s*(.+)$/);
    if (m) rows.push({ name: m[1].trim(), size: m[2].trim() });
  }
  return rows;
}

// Render a quote as a styled ITEM / SIZE table, echoing the proposal's table.
function QuoteTable({ rows }: { rows: { name: string; size: string }[] }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", margin: "2px 0" }}>
      <div style={{ display: "flex", gap: 16, background: "var(--surface-2)", padding: "11px 16px" }}>
        <span className="eyebrow" style={{ flex: 1 }}>ITEM</span>
        <span className="eyebrow" style={{ textAlign: "right" }}>SIZE</span>
      </div>
      {rows.map((r, i) => {
        const isSub = r.name.includes(" — ");
        return (
          <div key={i} style={{ display: "flex", gap: 16, padding: "11px 16px", borderTop: "1px solid var(--border-subtle)", alignItems: "baseline" }}>
            <span style={{ flex: 1, color: isSub ? "var(--text-muted)" : "var(--text-primary)", fontSize: 13.5, paddingLeft: isSub ? 16 : 0, lineHeight: 1.4 }}>{r.name}</span>
            <span className="mono tnum" style={{ color: "var(--accent)", fontSize: 12.5, textAlign: "right", whiteSpace: "nowrap" }}>{r.size}</span>
          </div>
        );
      })}
    </div>
  );
}

// Render an assistant message: narrative text, with any quote table promoted
// to the styled QuoteTable. Falls back to plain text when there's no table.
function renderAssistant(content: string): React.ReactNode {
  const cleaned = stripActions(content);
  const rows = parseQuoteRows(cleaned);
  if (rows.length === 0) return <>{renderMessage(content)}</>;

  const lines = cleaned.split("\n");
  const isTableLine = (l: string) => {
    const t = l.trim();
    return /^\d+\s*\|/.test(t) || /^#.*\|/.test(t) || /^(quote:|items:)$/i.test(t);
  };
  let first = -1, last = -1;
  lines.forEach((l, i) => { if (isTableLine(l)) { if (first === -1) first = i; last = i; } });
  const before = lines.slice(0, first).join("\n").trim();
  const after = lines.slice(last + 1).join("\n").trim();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {before && <div style={{ whiteSpace: "pre-wrap" }}>{renderMessage(before)}</div>}
      <QuoteTable rows={rows} />
      {after && <div style={{ whiteSpace: "pre-wrap" }}>{renderMessage(after)}</div>}
    </div>
  );
}

// Robust SSE reader. The previous inline parser split each network chunk on
// "\n" without buffering, so any `data: {json}` event split across two reads
// was dropped (invalid JSON -> caught -> lost), garbling the text. This keeps a
// buffer across reads and only parses COMPLETE lines, retaining the partial
// trailing line for the next read.
async function streamChatResponse(
  body: ReadableStream<Uint8Array>,
  onUpdate: (text: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";

  const handleLine = (raw: string): boolean => {
    const line = raw.replace(/\r$/, "");
    if (!line.startsWith("data: ")) return false;
    const data = line.slice(6);
    if (data === "[DONE]") return true;
    try {
      const json = JSON.parse(data);
      const delta = json.choices?.[0]?.delta?.content ?? "";
      if (delta) { accumulated += delta; onUpdate(accumulated); }
    } catch { /* incomplete/non-JSON line — skip */ }
    return false;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (handleLine(line)) return accumulated;
    }
  }
  // Flush any trailing complete line left without a newline.
  if (buffer) handleLine(buffer);
  return accumulated;
}

export default function ChatScreen({ isActive, adminControls = false }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>("idle");
  // At the quote-review stage we show only the big Confirm + Go Back buttons.
  // "Go Back" reveals the message-level options (Add an Item / Edit / Done).
  const [confirmActionsRevealed, setConfirmActionsRevealed] = useState(false);
  const [sending, setSending] = useState(false);
  const [testState, setTestState] = useState<"idle" | "sending" | "sent">("idle");
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<InputMode>(null);
  const [showResume, setShowResume] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<DraftData | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [audioHistory, setAudioHistory] = useState<number[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const greeted = useRef(false);
  const streamingRef = useRef(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const recordSampleRateRef = useRef<number>(48000);
  const startingRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1000);
    return () => clearTimeout(t);
  }, []);

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  // Property cleanup AI doesn't use mode buttons — it guides through phases directly
  const greetingDetected = false;
  const showModeButtons = !loading && !mode && !showResume && greetingDetected;
  const quoteReady = !loading && !!lastAssistantMessage && isQuoteComplete(lastAssistantMessage.content);
  // While the big Confirm + Go Back pair is showing, suppress the message-level
  // action buttons. Go Back flips confirmActionsRevealed to reveal them.
  const showBigConfirm = quoteReady && confirmState !== "sent" && !confirmActionsRevealed;

  const actionButtons = lastAssistantMessage ? extractActions(lastAssistantMessage.content) : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, quoteReady, showModeButtons, showResume, loading, actionButtons.length]);

  const persistDraft = useCallback(() => {
    saveDraft(messages, mode, confirmState, streamingRef.current);
  }, [messages, mode, confirmState]);

  useEffect(() => {
    if (messages.length > 1 && !streamingRef.current) {
      persistDraft();
    }
  }, [messages, mode, confirmState, persistDraft]);

  function handleInputFocus() {
    setTimeout(() => {
      // Scroll the message list to the bottom. (The input itself stays visible
      // because the app is pinned to the visual viewport — no window scroll.)
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 300);
  }

  useEffect(() => {
    if (!isActive || greeted.current) return;
    greeted.current = true;

    const draft = loadDraft();
    if (draft && draft.messages.length > 1) {
      setPendingDraft(draft);
      setShowResume(true);
      return;
    }

    greet();
  }, []);

  function resumeDraft() {
    if (!pendingDraft) return;
    setMessages(pendingDraft.messages);
    setMode(pendingDraft.mode);
    setConfirmState(pendingDraft.confirmState);
    setShowResume(false);
    setPendingDraft(null);
  }

  function declineDraft() {
    clearDraft();
    setShowResume(false);
    setPendingDraft(null);
    greet();
  }

  function handleNewQuote() {
    clearDraft();
    setMessages([]);
    setMode(null);
    setConfirmState("idle");
    setConfirmActionsRevealed(false);
    setInput("");
    greeted.current = false;
    streamingRef.current = false;
    greeted.current = true;
    greet();
  }

  async function handleSendTestQuote() {
    if (testState === "sending") return;
    setTestState("sending");
    try {
      const stored = localStorage.getItem("auth");
      const email = stored ? JSON.parse(stored).email : "admin@jrpropertycleanup.com";
      const res = await fetch("/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteText: randomTestQuote(), email, test: true }),
      });
      setTestState(res.ok ? "sent" : "idle");
    } catch {
      setTestState("idle");
    } finally {
      setTimeout(() => setTestState("idle"), 2000);
    }
  }

  async function greet() {
    setLoading(true);
    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([assistantMessage]);

    const stored = localStorage.getItem("auth");
    const userName = stored ? JSON.parse(stored).name : null;
    const userContext = userName ? `The user's name is ${userName}. Greet them by name.` : "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], userContext }),
      });
      if (!res.body) return;
      streamingRef.current = true;
      await streamChatResponse(res.body, (text) =>
        setMessages([{ role: "assistant", content: text }]),
      );
    } catch {
      setMessages([{
        role: "assistant",
        content: "Sorry — I couldn't start the quote builder. Please refresh the page and try again.",
      }]);
    } finally {
      streamingRef.current = false;
      setLoading(false);
    }
  }

  function selectMode(selected: InputMode) {
    if (!selected) return;
    setMode(selected);
    const label = selected === "sequential" ? "Add items one at a time" : "Paste full quote";
    const userMsg: Message = { role: "user", content: label };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    streamResponse(newMessages);
  }

  async function streamResponse(msgHistory: Message[]) {
    setLoading(true);
    setConfirmState("idle");
    setConfirmActionsRevealed(false);
    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...msgHistory, assistantMessage]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgHistory }),
      });

      if (!res.body) throw new Error("No response body");

      streamingRef.current = true;
      await streamChatResponse(res.body, (text) =>
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: text };
          return updated;
        }),
      );
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Error: could not reach the model." };
        return updated;
      });
    } finally {
      streamingRef.current = false;
      setLoading(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    streamResponse(newMessages);
  }

  async function handleConfirmSend() {
    if (confirmState === "idle") {
      setConfirmState("confirmed");
      return;
    }

    if (confirmState === "confirmed") {
      setSending(true);
      try {
        const stored = localStorage.getItem("auth");
        const email = stored ? JSON.parse(stored).email : null;
        const quoteText = lastAssistantMessage?.content ?? "";
        const res = await fetch("/api/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quoteText, email }),
        });
        if (res.ok) {
          setConfirmState("sent");
          clearDraft();
        }
      } finally {
        setSending(false);
      }
    }
  }

  const confirmLabel =
    confirmState === "idle" ? "CONFIRM" :
    confirmState === "confirmed" ? "SEND" :
    "SENT";

  const confirmBg =
    confirmState === "idle" ? "transparent" :
    confirmState === "confirmed" ? "var(--accent)" :
    "var(--surface-2)";

  const confirmBorder =
    confirmState === "idle" ? "1.5px solid var(--accent-border)" :
    confirmState === "confirmed" ? "1.5px solid transparent" :
    "1px solid var(--border)";

  const confirmColor =
    confirmState === "idle" ? "var(--accent)" :
    confirmState === "confirmed" ? "var(--accent-contrast)" :
    "var(--text-muted)";

  const modeButtonStyle = {
    background: "transparent",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-secondary)",
    padding: "9px 16px",
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: "0.04em",
    cursor: "pointer" as const,
    transition: "border-color 0.2s, background 0.2s, color 0.2s",
  };

  const hasProgress = mode !== null && messages.length > 1;

  async function startRecording() {
    if (startingRef.current || recording) return; // guard against double-taps
    startingRef.current = true;
    setVoiceHint(null);

    // getUserMedia only exists in a secure context (HTTPS or localhost). On a
    // phone hitting the dev server over a LAN IP (http) it's undefined, so fail
    // loudly instead of silently doing nothing.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      startingRef.current = false;
      flashHint("Voice needs a secure (HTTPS) connection");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // The browser's own noise suppression + auto gain (enabled above) clean
      // the track. The analyser drives the waveform meter; the processor taps
      // raw PCM straight off the graph so we never touch webm/opus.
      // iOS Safari historically exposed only webkitAudioContext.
      const AudioCtx: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      // A fresh AudioContext can start suspended; without this, short clips
      // capture zero samples because onaudioprocess never fires in time.
      await audioCtx.resume();
      recordSampleRateRef.current = audioCtx.sampleRate;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Capture raw PCM. Both capture nodes feed a muted gain → destination so
      // they stay in the active graph (and produce no audible feedback).
      pcmChunksRef.current = [];
      const sink = audioCtx.createGain();
      sink.gain.value = 0;
      sink.connect(audioCtx.destination);

      // Prefer AudioWorklet — the modern, reliable capture path that actually
      // works on iOS Safari. Fall back to the deprecated ScriptProcessorNode if
      // the worklet can't load (very old browsers).
      let usedWorklet = false;
      if (audioCtx.audioWorklet) {
        try {
          await audioCtx.audioWorklet.addModule("/pcm-worklet.js");
          const node = new AudioWorkletNode(audioCtx, "pcm-processor");
          node.port.onmessage = (e) => {
            pcmChunksRef.current.push(e.data as Float32Array);
          };
          source.connect(node);
          node.connect(sink);
          workletNodeRef.current = node;
          usedWorklet = true;
        } catch (e) {
          console.warn("AudioWorklet unavailable; falling back to ScriptProcessor", e);
        }
      }
      if (!usedWorklet) {
        const processor = audioCtx.createScriptProcessor(2048, 1, 1);
        processor.onaudioprocess = (ev) => {
          pcmChunksRef.current.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
        };
        source.connect(processor);
        processor.connect(sink);
        processorRef.current = processor;
      }
      setRecording(true);

      const MAX_BARS = 80;
      let lastPush = 0;
      function updateLevels(time: number) {
        if (!analyserRef.current) return;
        if (time - lastPush > 80) {
          const data = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length / 255;
          const gated = avg < 0.08 ? 0 : Math.min(1, (avg - 0.08) / 0.15);
          setAudioHistory((prev) => {
            const next = [...prev, gated];
            return next.length > MAX_BARS ? next.slice(next.length - MAX_BARS) : next;
          });
          lastPush = time;
        }
        animFrameRef.current = requestAnimationFrame(updateLevels);
      }
      animFrameRef.current = requestAnimationFrame(updateLevels);
    } catch (err) {
      // Surface the real failure instead of silently doing nothing.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setRecording(false);
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") flashHint("Microphone access was blocked");
      else if (name === "NotFoundError") flashHint("No microphone found");
      else flashHint("Couldn't start the mic — try again");
      console.error("startRecording failed:", err);
    } finally {
      startingRef.current = false;
    }
  }

  async function stopRecording() {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setAudioHistory([]);
    setRecording(false);

    const processor = processorRef.current;
    const worklet = workletNodeRef.current;
    const audioCtx = audioCtxRef.current;
    processorRef.current = null;
    workletNodeRef.current = null;

    // Tear down the graph and release the mic.
    if (processor) {
      processor.onaudioprocess = null;
      processor.disconnect();
    }
    if (worklet) {
      worklet.port.onmessage = null;
      worklet.disconnect();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const srcRate = recordSampleRateRef.current;
    if (audioCtx) {
      audioCtx.close();
      audioCtxRef.current = null;
    }

    // Stitch the captured PCM chunks into one buffer.
    const chunks = pcmChunksRef.current;
    pcmChunksRef.current = [];
    const total = chunks.reduce((n, c) => n + c.length, 0);
    if (total === 0) {
      flashHint("Didn't catch that — hold the mic a moment longer");
      return;
    }
    const pcm = new Float32Array(total);
    let off = 0;
    for (const c of chunks) { pcm.set(c, off); off += c.length; }

    setTranscribing(true);
    try {
      const base64 = pcmToWavBase64(pcm, srcRate);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64, format: "wav" }),
      });
      if (res.ok) {
        const { text } = await res.json();
        if (text && text.trim()) {
          setInput(text.trim());
        } else {
          // Server collapses refusals / inaudible audio to empty — never leak
          // model chatter into the input box.
          flashHint("Didn't catch that — try again");
        }
      } else {
        flashHint("Transcription failed — try again");
        console.error("Transcription request failed", res.status, await res.text());
      }
    } catch (err) {
      flashHint("Transcription failed — try again");
      console.error("Transcription error", err);
    } finally {
      setTranscribing(false);
    }
  }

  function flashHint(msg: string) {
    setVoiceHint(msg);
    setTimeout(() => setVoiceHint(null), 2500);
  }

  function handleMicClick() {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  async function compressImage(file: File): Promise<{ base64: string; dataUrl: string }> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxW = 1920;
        let w = img.width;
        let h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        const base64 = dataUrl.split(",")[1];
        resolve({ base64, dataUrl });
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-selected
    e.target.value = "";

    setUploadingPhoto(true);
    try {
      const { base64, dataUrl } = await compressImage(file);

      // Determine current section from the last assistant message
      const sectionHint = lastAssistantMessage?.content?.match(/(?:photo of the |photo of |servicing the |the )([A-Za-z ]+?)(?:\?|\.|\s*before)/i)?.[1]?.trim() ?? "property";

      // Show thumbnail in chat immediately
      const photoMsg: Message = { role: "user", content: `[Photo uploaded: ${sectionHint}]`, imageUrl: dataUrl };
      const newMessages: Message[] = [...messages, photoMsg];
      setMessages(newMessages);

      // Upload to backend (fire and forget — don't block chat flow)
      fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, section: sectionHint, format: "jpeg" }),
      }).catch(() => {/* non-critical */});

      // Tell the AI the photo was uploaded
      streamResponse(newMessages);
    } catch {
      flashHint("Couldn't process that photo — try again");
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <div
      className="flex flex-col w-full h-full chat-font"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.5s ease",
        fontFamily: "var(--font-geist-sans), sans-serif",
        fontWeight: 400,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-4 chat-header"
        style={{ borderBottom: "1px solid var(--border)", justifyContent: "space-between" }}
      >
        <span className="eyebrow" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}><span className="slash">/</span>QUOTE BUILDER</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {adminControls && (
            <button
              onClick={handleSendTestQuote}
              disabled={testState === "sending"}
              style={{
                background: testState === "sent" ? "var(--accent-subtle)" : "transparent",
                border: `1px solid ${testState === "sent" ? "var(--accent-border)" : "var(--border-strong)"}`,
                borderRadius: "var(--radius-sm)",
                color: testState === "sent" ? "var(--accent)" : "var(--text-muted)",
                fontSize: "10.5px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: testState === "sending" ? "wait" : "pointer",
                padding: "5px 10px",
                whiteSpace: "nowrap",
                transition: "color 0.2s, border-color 0.2s, background 0.2s",
              }}
              onMouseEnter={(e) => { if (testState === "idle") { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.color = "var(--accent)"; } }}
              onMouseLeave={(e) => { if (testState === "idle") { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-muted)"; } }}
            >
              {testState === "sending" ? "SENDING" : testState === "sent" ? "SENT" : (
                <>
                  <span className="hide-mobile">SEND TEST QUOTE</span>
                  <span className="only-mobile">TEST</span>
                </>
              )}
            </button>
          )}
          {hasProgress && confirmState !== "sent" && (
            <button
              onClick={handleNewQuote}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-faint)",
                fontSize: "10.5px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: "pointer",
                padding: "5px 6px",
                whiteSpace: "nowrap",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-faint)")}
            >
              NEW QUOTE
            </button>
          )}
        </div>
      </div>

      {/* Resume prompt */}
      {showResume && (
        <div className="flex-1 flex items-center justify-center">
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 16, padding: 24 }}>
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              You have an unfinished quote. Resume where you left off?
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={resumeDraft}
                style={{
                  background: "var(--accent)",
                  border: "1.5px solid transparent",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--accent-contrast)",
                  padding: "10px 24px",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                RESUME
              </button>
              <button
                onClick={declineDraft}
                style={{
                  ...modeButtonStyle,
                  padding: "10px 24px",
                }}
              >
                START FRESH
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {!showResume && (
        <>
          <div className="flex-1 overflow-y-auto chat-messages flex flex-col gap-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className="flex"
                style={{ justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}
              >
                <div
                  style={msg.role === "user" ? {
                    maxWidth: "72%",
                    padding: "10px 16px",
                    borderRadius: "var(--radius) var(--radius) 4px var(--radius)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  } : {
                    maxWidth: 760,
                    width: "100%",
                    color: "var(--text-secondary)",
                    fontSize: "14.5px",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.role === "assistant" ? renderAssistant(msg.content) : (
                    <>
                      {msg.imageUrl && (
                        <img
                          src={msg.imageUrl}
                          alt="Uploaded photo"
                          style={{ display: "block", maxWidth: "100%", maxHeight: 200, borderRadius: "var(--radius-sm)", marginBottom: msg.content ? 6 : 0, objectFit: "cover" }}
                        />
                      )}
                      {msg.content}
                    </>
                  )}
                  {msg.role === "assistant" && loading && i === messages.length - 1 && msg.content === "" && (
                    <span style={{ color: "var(--accent)", opacity: 0.7 }}>|</span>
                  )}
                </div>
              </div>
            ))}

            {/* Mode selection buttons */}
            {showModeButtons && (
              <div className="flex gap-2 mobile-mode-buttons" style={{ paddingTop: "4px", justifyContent: "flex-start" }}>
                <button
                  onClick={() => selectMode("sequential")}
                  style={modeButtonStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.background = "var(--accent-subtle)"; e.currentTarget.style.color = "var(--accent)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  ADD ONE AT A TIME
                </button>
                <button
                  onClick={() => selectMode("bulk")}
                  style={modeButtonStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.background = "var(--accent-subtle)"; e.currentTarget.style.color = "var(--accent)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  PASTE FULL QUOTE
                </button>
              </div>
            )}

            {/* AI-driven action buttons (suppressed while the big Confirm + Go
                Back pair is showing, and after the quote is sent) */}
            {!loading && !showModeButtons && !showBigConfirm && confirmState !== "sent" && lastAssistantMessage && (() => {
              // After "Go Back" at the quote-review stage, show a fixed set;
              // otherwise use the model's own [ACTIONS] buttons.
              const revealedQuote = quoteReady && confirmActionsRevealed;
              const actions = revealedQuote
                ? ["Add an Item", "Edit", "Done"]
                : extractActions(lastAssistantMessage.content);
              if (actions.length === 0) return null;
              return (
                <div className="flex gap-2 mobile-mode-buttons" style={{ paddingTop: "4px", justifyContent: "flex-start", flexWrap: "wrap" }}>
                  {actions.map((action) => (
                    <button
                      key={action}
                      onClick={() => {
                        // At the quote-review stage "Done" just returns to the
                        // Confirm / Go Back view — the quote is already on screen,
                        // no need to round-trip the model.
                        if (revealedQuote && action === "Done") {
                          setConfirmActionsRevealed(false);
                          return;
                        }
                        const newMessages: Message[] = [...messages, { role: "user", content: action }];
                        setMessages(newMessages);
                        streamResponse(newMessages);
                      }}
                      style={modeButtonStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.background = "var(--accent-subtle)"; e.currentTarget.style.color = "var(--accent)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                    >
                      {action.toUpperCase()}
                    </button>
                  ))}
                </div>
              );
            })()}

            <div ref={bottomRef} />
          </div>

          {/* Confirm / Send + Go Back */}
          {showBigConfirm && (
            <div className="flex justify-start chat-header" style={{ borderTop: "1px solid var(--border)", gap: 12 }}>
              <button
                onClick={handleConfirmSend}
                disabled={sending}
                style={{
                  background: confirmBg,
                  border: confirmBorder,
                  borderRadius: "var(--radius)",
                  color: confirmColor,
                  padding: "11px 40px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  cursor: sending ? "not-allowed" : "pointer",
                  transition: "background 0.3s ease, color 0.3s ease",
                  opacity: sending ? 0.6 : 1,
                }}
              >
                {sending ? "SENDING" : confirmLabel}
              </button>
              <button
                onClick={() => setConfirmActionsRevealed(true)}
                disabled={sending}
                style={{
                  background: "transparent",
                  border: "1.5px solid var(--accent-border)",
                  borderRadius: "var(--radius)",
                  color: "var(--accent)",
                  padding: "11px 40px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  cursor: sending ? "not-allowed" : "pointer",
                  opacity: sending ? 0.6 : 1,
                  transition: "background 0.2s ease",
                }}
                onMouseEnter={(e) => { if (!sending) e.currentTarget.style.background = "var(--accent-subtle)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                GO BACK
              </button>
            </div>
          )}

          {confirmState === "sent" && (
            <div className="flex justify-center chat-header" style={{ borderTop: "1px solid var(--border)", gap: 8, alignItems: "center" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
              <span style={{ color: "var(--accent)", fontSize: "12.5px", fontWeight: 600, letterSpacing: "0.06em" }}>
                Quote sent successfully
              </span>
            </div>
          )}

          {/* Input */}
          <div
            className="chat-input-bar"
            style={{ borderTop: "1px solid var(--border)", alignItems: "center" }}
          >
            {recording ? (
              <div style={{
                flex: "1 1 0%",
                minWidth: 0,
                background: "var(--surface-2)",
                border: "1px solid rgba(239,68,68,0.45)",
                borderRadius: "var(--radius)",
                padding: "10px 16px",
                height: 42,
                display: "flex",
                alignItems: "center",
                gap: 2,
                overflow: "hidden",
                justifyContent: "flex-end",
              }}>
                {audioHistory.length > 0 ? audioHistory.map((level, i) => (
                  <div
                    key={i}
                    style={{
                      width: 3,
                      borderRadius: 2,
                      backgroundColor: "#ef4444",
                      height: `${Math.max(4, Math.pow(level, 0.5) * 32)}px`,
                      flexShrink: 0,
                    }}
                  />
                )) : (
                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Listening...</span>
                )}
              </div>
            ) : transcribing ? (
              <div style={{
                flex: "1 1 0%",
                minWidth: 0,
                background: "var(--surface-2)",
                border: "1px solid var(--accent-border)",
                borderRadius: "var(--radius)",
                padding: "10px 16px",
                height: 42,
                display: "flex",
                alignItems: "center",
              }}>
                <span style={{ color: "var(--accent)", fontSize: 13, letterSpacing: "0.04em" }}>Transcribing…</span>
              </div>
            ) : (
              <input
                ref={inputRef}
                className="chat-text-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                onFocus={handleInputFocus}
                placeholder={voiceHint || (mode === "bulk" ? "Paste your full quote here..." : "Describe an item, or say 'done'...")}
                style={{
                  flex: "1 1 0%",
                  minWidth: 0,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "10px 16px",
                  color: "var(--text-primary)",
                  fontSize: "14px",
                  outline: "none",
                  height: 42,
                }}
              />
            )}

            {/* Photo upload button */}
            <label
              className="photo-upload-btn"
              title="Upload photo"
              style={{ opacity: uploadingPhoto ? 0.5 : 1, cursor: uploadingPhoto ? "wait" : "pointer" }}
            >
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
              />
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </label>

            {/* Mic button — hidden on mobile; the OS keyboard's dictation mic
                handles voice there (see .mic-button rule in globals.css). */}
            <button
              className="mic-button"
              onClick={handleMicClick}
              aria-label={recording ? "Stop recording" : "Record voice input"}
              aria-pressed={recording}
              style={{
                background: recording ? "rgba(239,68,68,0.15)" : "transparent",
                border: "none",
                borderRadius: "50%",
                width: 38,
                height: 38,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: recording ? "#ef4444" : "var(--text-muted)",
                transition: "color 0.2s, background 0.2s",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="1" width="6" height="12" rx="3" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>

            {/* Send button — paper airplane */}
            <button
              onClick={recording ? () => stopRecording() : sendMessage}
              aria-label={recording ? "Finish recording" : "Send message"}
              disabled={!recording && (loading || !input.trim())}
              style={{
                background: "transparent",
                border: "none",
                borderRadius: "50%",
                width: 38,
                height: 38,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: (!recording && (loading || !input.trim())) ? "not-allowed" : "pointer",
                opacity: (!recording && (loading || !input.trim())) ? 0.3 : 1,
                color: recording ? "var(--accent)" : "var(--text-secondary)",
                transition: "color 0.2s, opacity 0.2s",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
