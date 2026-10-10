export const EUCLID_GATE_EQUATION = {
  name: "Euclid Gate",
  formula: "gate=((n*(k+1)+seed) mod m) < k",
  compute: function (ctx, inst) {
    const steps = 16;
    const pulses = Math.max(1, Math.round(inst.density * 11));
    const gate = ((ctx.step * (pulses + 1) + inst.seedOffset) % steps) < pulses;
    return gate ? 0.9 : 0.08;
  }
};
