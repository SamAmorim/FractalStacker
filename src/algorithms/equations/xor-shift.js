export const XOR_SHIFT_EQUATION = {
  name: "Xor Shift",
  formula: "x=n^(n<<13)^(n>>17)^(n<<5)",
  compute: function (ctx, inst) {
    let x = (ctx.step + inst.seedOffset + 1) | 0;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1024) / 1024;
  }
};
