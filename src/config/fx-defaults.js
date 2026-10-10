export const DEFAULT_INSTRUMENT_FX = {
  delayEnabled: false,
  delaySync: "off",
  delayPingPong: false,
  delayTime: 0.24,
  delayFeedback: 0.28,
  delayMix: 0.18,
  reverbEnabled: false,
  reverbAmount: 0.16,
  reverbSize: 0.4,
  sendAmount: 0
};

export const DEFAULT_MASTER_FX = {
  enabled: false,
  wahEnabled: false,
  wahMode: "lfo",
  wahRate: 1.6,
  wahDepth: 820,
  wahPosition: 0.45,
  delayEnabled: true,
  delaySync: "off",
  delayPingPong: false,
  delayTime: 0.29,
  delayFeedback: 0.34,
  delayMix: 0.24,
  reverbEnabled: true,
  reverbAmount: 0.2,
  reverbSize: 0.55
};

export function createInstrumentFx(overrides) {
  return Object.assign({}, DEFAULT_INSTRUMENT_FX, overrides || {});
}

export function createMasterFx(overrides) {
  return Object.assign({}, DEFAULT_MASTER_FX, overrides || {});
}
