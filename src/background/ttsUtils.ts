export interface VoiceOption {
  name: string;
  lang: string;
}

export const getAvailableVoices = (): Promise<VoiceOption[]> => {
  return new Promise((resolve) => {
    let voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      resolve(voices.map((voice) => ({ name: voice.name, lang: voice.lang })));
      return;
    }

    const handleVoicesChanged = () => {
      voices = window.speechSynthesis.getVoices();
      if (voices.length) {
        resolve(voices.map((voice) => ({ name: voice.name, lang: voice.lang })));
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      }
    };
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
  });
};

let currentUtterance: SpeechSynthesisUtterance | null = null;
let onEndCallback: (() => void) | null = null;
let onStartCallback: (() => void) | null = null;
let onPauseCallback: (() => void) | null = null;
let onResumeCallback: (() => void) | null = null;

let isSpeechPaused = false;
let currentText = '';
let currentVoice: SpeechSynthesisVoice | null = null;
let currentRate = 1;

export const isCurrentlySpeaking = (): boolean => window.speechSynthesis.speaking;
export const isCurrentlyPaused = (): boolean => 
  isSpeechPaused || window.speechSynthesis.paused;

export const speakMessage = (
  text: string,
  voiceName?: string,
  rate: number = 1,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onPause?: () => void;
    onResume?: () => void;
  }
) => {
  if (isCurrentlySpeaking() || window.speechSynthesis.pending) {
    stopSpeech();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;

  if (voiceName) {
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find((voice) => voice.name === voiceName);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    } else {
      console.warn(`Voice "${voiceName}" not found. Using default.`);
    }
  }

  onStartCallback = callbacks?.onStart || null;
  onEndCallback = callbacks?.onEnd || null;
  onPauseCallback = callbacks?.onPause || null;
  onResumeCallback = callbacks?.onResume || null;

  utterance.onstart = () => {
    currentUtterance = utterance;
    if (onStartCallback) onStartCallback();
  };

  utterance.onend = () => {
    if (currentUtterance === utterance) {
        currentUtterance = null;
        if (onEndCallback) onEndCallback();
        onStartCallback = onEndCallback = onPauseCallback = onResumeCallback = null;
    }
  };

  utterance.onpause = () => {
     if (currentUtterance === utterance && onPauseCallback) onPauseCallback();
  };

  utterance.onresume = () => {
     if (currentUtterance === utterance && onResumeCallback) onResumeCallback();
  };

  utterance.onerror = (event) => {
    console.error('SpeechSynthesisUtterance error:', event.error);
     if (currentUtterance === utterance) {
        currentUtterance = null;
        if (onEndCallback) onEndCallback();
        onStartCallback = onEndCallback = onPauseCallback = onResumeCallback = null;
     }
  };

  window.speechSynthesis.speak(utterance);
};

export const stopSpeech = () => {
  if (!currentUtterance && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
    return;
  }
  const callback = onEndCallback;
  currentUtterance = null;
  currentText = '';
  currentVoice = null;
  isSpeechPaused = false;
  onStartCallback = onEndCallback = onPauseCallback = onResumeCallback = null;

  window.speechSynthesis.cancel();

  if (callback) {
    callback();
  }
};

export const pauseSpeech = () => {
  if (currentUtterance && isCurrentlySpeaking() && !isSpeechPaused) {
    try {
      isSpeechPaused = true;
      window.speechSynthesis.pause();
      if (onPauseCallback) onPauseCallback();
    } catch (error) {
      console.error('Error pausing speech:', error);
      if (currentUtterance) {
        currentText = currentUtterance.text;
        currentVoice = currentUtterance.voice;
        currentRate = currentUtterance.rate;
      }
    }
  }
};

export const resumeSpeech = () => {
  if (!isSpeechPaused) return;

  try {
    window.speechSynthesis.resume();
    isSpeechPaused = false;
    if (onResumeCallback) onResumeCallback();
  } catch (error) {
    console.error('Error resuming speech, attempting fallback:', error);
    if (currentText && currentUtterance) {
      window.speechSynthesis.cancel();
      const newUtterance = new SpeechSynthesisUtterance(currentText);
      newUtterance.voice = currentVoice;
      newUtterance.rate = currentRate;
      
      newUtterance.onend = currentUtterance.onend;
      newUtterance.onstart = currentUtterance.onstart;
      newUtterance.onpause = currentUtterance.onpause;
      newUtterance.onresume = currentUtterance.onresume;
      newUtterance.onerror = currentUtterance.onerror;
      
      currentUtterance = newUtterance;
      window.speechSynthesis.speak(newUtterance);
      isSpeechPaused = false;
      if (onResumeCallback) onResumeCallback();
    }
  }
};
