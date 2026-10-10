export const FIBONACCI_EQUATION = {
  name: "Fibonacci",
  formula: "F(n)=F(n-1)+F(n-2) ; value=(F(n) mod 89)/89",
  compute: function (ctx, inst) {
    const n = (ctx.step + inst.seedOffset) % 18 + 2;
    let a = 1;
    let b = 1;
    for (let i = 2; i < n; i += 1) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    return (b % 89) / 89;
  }
};
