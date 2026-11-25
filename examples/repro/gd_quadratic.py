"""Gradient descent on f(x) = x^2 from x0 = 1 for 50 steps. Prints metrics JSON last."""
import json, sys
lr = float(sys.argv[1]) if len(sys.argv) > 1 else 2.5
x = 1.0
for _ in range(50):
    x -= lr * 2 * x
print(json.dumps({"lr": lr, "final_abs_x": abs(x), "diverged": abs(x) > 1.0}))
