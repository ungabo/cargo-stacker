export function createAudioBus(audioManifest) {
  const clips = new Map();
  const volumes = {
    gameOver: 0.72,
    splash: 0.52,
  };

  Object.entries(audioManifest).forEach(([name, src]) => {
    const audio = new Audio(src);
    audio.preload = 'auto';
    clips.set(name, audio);
  });

  return {
    warm() {
      clips.forEach((audio) => {
        audio.load();
      });
    },
    play(name, enabled = true) {
      if (!enabled) {
        return;
      }

      const source = clips.get(name);
      if (!source) {
        return;
      }

      const audio = source.cloneNode();
      audio.volume = volumes[name] ?? 0.86;
      audio.play().catch(() => {});
    },
  };
}
