import { nthPrime } from "../../core/math.js";

export const PRIME_STEP_EQUATION = {
  name: "Prime Step",
  formula: "value=(prime(n) mod 29)/29",
  compute: function (ctx, inst) {
    const p = nthPrime((ctx.step + inst.seedOffset) % 28 + 2);
    return (p % 29) / 29;
  }
};
