// Alert sounds and buzzes for Live data, the dashboard, the shift light, the
// knock monitor and the DPF monitor. The buzz always runs; the sound plays
// only while Alert sounds is on in Settings (on by default).
//
// Sounds play even with the phone's silent switch on, and mix with music or
// navigation rather than stopping it. The beeps are made by
// scripts/make-sounds.mjs.
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type AlertSound = 'alert' | 'shift' | 'warn';

const FILES: Record<AlertSound, number> = {
  alert: require('../assets/sounds/alert.wav'),
  shift: require('../assets/sounds/shift.wav'),
  warn: require('../assets/sounds/warn.wav'),
};

let soundsOn = true;
let modeSet = false;
const players: Partial<Record<AlertSound, AudioPlayer>> = {};

// Settings calls this when Alert sounds changes.
export function setAlertSounds(on: boolean): void {
  soundsOn = on;
}

export function playSound(kind: AlertSound): void {
  if (!soundsOn) return;
  try {
    if (!modeSet) {
      modeSet = true;
      setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: true }).catch(() => undefined);
    }
    let p = players[kind];
    if (!p) {
      p = createAudioPlayer(FILES[kind]);
      players[kind] = p;
    }
    const player = p;
    player
      .seekTo(0)
      .catch(() => undefined)
      .finally(() => {
        try {
          player.play();
        } catch {
          // no sound on this phone
        }
      });
  } catch {
    // A missing sound must never stop the reading.
  }
}

// One alert: a buzz and, if on, a sound.
export function alertBuzz(kind: AlertSound = 'alert'): void {
  if (Platform.OS !== 'web') {
    const buzz =
      kind === 'shift'
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    buzz.catch(() => undefined);
  }
  playSound(kind);
}
