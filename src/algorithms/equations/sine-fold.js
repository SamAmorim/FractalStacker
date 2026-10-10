import { PHI } from "../../config/constants.js";

export const SINE_FOLD_EQUATION = {
  name: "Sine Fold",
  formula: "value=(sin((n+seed)*phi*k)+1)/2",
  compute: function (ctx, inst) {
    const k = 0.17 + ctx.chaos * 0.22;
    return (Math.sin((ctx.step + inst.seedOffset) * PHI * k) + 1) * 0.5;
  }
};
