import type { Language } from '../store/useAppStore';

/**
 * Text-to-speech behind an interface (§3). Default uses Web Speech
 * `speechSynthesis` (offline, robotic). If VITE_TTS_PROVIDER names a better
 * provider AND a key is present a different implementation could be wired here;
 * for the demo we always fall back to Web Speech so it works with zero setup.
 */
export interface TTSService {
  isSupported(): boolean;
  speak(text: string, lang: Language): Promise<void>;
  cancel(): void;
}

class WebSpeechTTS implements TTSService {
  private synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;

  isSupported(): boolean {
    return !!this.synth;
  }

  private pickVoice(lang: Language): SpeechSynthesisVoice | undefined {
    if (!this.synth) return undefined;
    const voices = this.synth.getVoices();
    const wanted = lang === 'fr' ? 'fr' : 'en';
    return voices.find((v) => v.lang.toLowerCase().startsWith(wanted)) ?? voices[0];
  }

  speak(text: string, lang: Language): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) {
        resolve();
        return;
      }
      this.synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
      const voice = this.pickVoice(lang);
      if (voice) utter.voice = voice;
      utter.rate = 1.02;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      // Safety: never let a stuck utterance hang the state machine.
      const words = text.split(/\s+/).length;
      window.setTimeout(() => resolve(), 2000 + words * 400);
      this.synth.speak(utter);
    });
  }

  cancel(): void {
    this.synth?.cancel();
  }
}

const provider = import.meta.env.VITE_TTS_PROVIDER as string | undefined;

// Only Web Speech is implemented for the demo; the env flag is read so a
// future provider can be slotted in without changing callers.
export const tts: TTSService = new WebSpeechTTS();
export const ttsProviderName = provider ?? 'web-speech';
