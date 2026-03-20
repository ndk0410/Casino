'use client';

import { Howl } from 'howler';

class AudioManager {
  private sounds: { [key: string]: Howl } = {};

  constructor() {
    this.sounds = {
      deal: new Howl({ src: ['/sounds/deal.mp3'], volume: 0.5 }),
      chip: new Howl({ src: ['/sounds/chip.mp3'], volume: 0.6 }),
      win: new Howl({ src: ['/sounds/win.mp3'], volume: 0.8 }),
      lose: new Howl({ src: ['/sounds/lose.mp3'], volume: 0.8 }),
      click: new Howl({ src: ['/sounds/click.mp3'], volume: 0.4 }),
      flip: new Howl({ src: ['/sounds/flip.mp3'], volume: 0.5 }),
    };
  }

  play(sound: keyof typeof this.sounds) {
    if (this.sounds[sound]) {
      this.sounds[sound].play();
    }
  }
}

export const audioManager = new AudioManager();
