import { clamp } from "../core/math.js";

export function getTriggerDecision(inst, value, step) {
  const density = clamp(inst.density, 0.02, 1);
  let threshold = 1 - density;
  if (inst.role === "pad") {
    threshold += 0.1;
  }
  if (inst.role === "drums") {
    threshold -= 0.12;
  }
  threshold = clamp(threshold, 0.02, 0.98);

  const deterministicPulseModulo = Math.max(2, Math.floor(10 - density * 8));
  const deterministicPulse = (step + inst.seedOffset) % deterministicPulseModulo === 0;
  const stepAligned = step % inst.stepDiv === 0;

  if (!inst.enabled) {
    return {
      trigger: false,
      threshold: threshold,
      deterministicPulse: deterministicPulse,
      stepAligned: stepAligned,
      reason: "disabled"
    };
  }

  if (!stepAligned) {
    return {
      trigger: false,
      threshold: threshold,
      deterministicPulse: deterministicPulse,
      stepAligned: false,
      reason: "step-div"
    };
  }

  if (value > threshold) {
    return {
      trigger: true,
      threshold: threshold,
      deterministicPulse: deterministicPulse,
      stepAligned: true,
      reason: "value>threshold"
    };
  }

  if (deterministicPulse) {
    return {
      trigger: true,
      threshold: threshold,
      deterministicPulse: true,
      stepAligned: true,
      reason: "deterministic-pulse"
    };
  }

  return {
    trigger: false,
    threshold: threshold,
    deterministicPulse: deterministicPulse,
    stepAligned: true,
    reason: "below-threshold"
  };
}
