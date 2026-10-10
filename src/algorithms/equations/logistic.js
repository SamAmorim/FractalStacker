import { clamp } from "../../core/math.js";

export const LOGISTIC_EQUATION = {
  name: "Logistic Map",
  formula: "x(n+1)=r*x(n)*(1-x(n)) ; r=3.5..3.99",
  compute: function (ctx, inst) {
    if (typeof inst.eqState.logistic !== "number") {
      inst.eqState.logistic = 0.17 + (inst.seedOffset % 13) * 0.03;
    }
    const r = 3.5 + ctx.chaos * 0.49;
    inst.eqState.logistic = r * inst.eqState.logistic * (1 - inst.eqState.logistic);
    return clamp(inst.eqState.logistic, 0, 1);
  }
};
