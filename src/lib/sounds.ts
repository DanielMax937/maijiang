/**
 * Sound Effects Hook for Mahjong
 * Uses Web Audio API for generating tile sounds
 */

// Audio context singleton
let audioContext: AudioContext | null = null;

interface WindowWithWebkitAudio extends Window {
    webkitAudioContext?: typeof AudioContext;
}

function getAudioContext(): AudioContext {
    if (!audioContext) {
        const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
        if (!AudioContextClass) {
            throw new Error("AudioContext is not available");
        }
        audioContext = new AudioContextClass();
    }
    return audioContext;
}

// Generate a simple click/tap sound for tile interactions
function playTone(frequency: number, duration: number, volume: number = 0.3): void {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = "sine";

        gainNode.gain.setValueAtTime(volume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
        // Audio not available, fail silently
        console.warn("Audio not available:", e);
    }
}

// Sound effect types
export const SoundEffects = {
    tileClick: () => playTone(800, 0.05, 0.2),
    tileDraw: () => playTone(600, 0.1, 0.15),
    tileDiscard: () => playTone(400, 0.08, 0.2),
    tilePeng: () => {
        playTone(523, 0.1, 0.3); // C
        setTimeout(() => playTone(659, 0.1, 0.3), 100); // E
    },
    tileGang: () => {
        playTone(523, 0.08, 0.3); // C
        setTimeout(() => playTone(659, 0.08, 0.3), 80); // E
        setTimeout(() => playTone(784, 0.12, 0.3), 160); // G
    },
    tileChi: () => {
        playTone(440, 0.08, 0.25); // A
        setTimeout(() => playTone(554, 0.08, 0.25), 80); // C#
    },
    tileHu: () => {
        // Victory fanfare
        playTone(523, 0.15, 0.4); // C
        setTimeout(() => playTone(659, 0.15, 0.4), 150); // E
        setTimeout(() => playTone(784, 0.15, 0.4), 300); // G
        setTimeout(() => playTone(1047, 0.3, 0.5), 450); // High C
    },
    turnChange: () => playTone(350, 0.05, 0.1),
    timer: () => playTone(1000, 0.03, 0.15),
    gameOver: () => {
        playTone(392, 0.2, 0.3); // G
        setTimeout(() => playTone(330, 0.2, 0.3), 200); // E
        setTimeout(() => playTone(262, 0.4, 0.3), 400); // C
    }
};

// Sound settings
let soundEnabled = true;

export function setSoundEnabled(enabled: boolean): void {
    soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
    return soundEnabled;
}

// Wrapper that respects sound settings
export function playSound(soundType: keyof typeof SoundEffects): void {
    if (soundEnabled) {
        SoundEffects[soundType]();
    }
}
