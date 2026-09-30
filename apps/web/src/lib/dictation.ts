// Voice capture (§15) using the browser's own speech recognition — no library, no service, no upload.
// Chrome, Edge and Safari support it; elsewhere the mic button simply doesn't appear.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

const engine = (): (new () => Recognition) | undefined =>
  typeof window === "undefined"
    ? undefined
    : (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;

export const dictationSupported = () => !!engine();

/** Listens once and resolves with what was said (empty if nothing was caught). `stop` cancels it. */
export function dictate(onFinished: (text: string) => void): { stop: () => void } {
  const Engine = engine();
  if (!Engine) return { stop: () => {} };

  const recognition = new Engine();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;
  let heard = "";

  recognition.onresult = (event) => {
    heard = Array.from(event.results, (result) => result[0].transcript).join(" ").trim();
  };
  recognition.onerror = () => {};
  recognition.onend = () => onFinished(heard);
  recognition.start();
  return { stop: () => recognition.stop() };
}
