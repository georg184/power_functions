"""Independently prove generated answers and every solution step with SymPy."""

import json
from pathlib import Path
import subprocess
from typing import Any

import sympy as sp

ROOT: Path = Path(__file__).resolve().parent.parent


def expression(node: dict[str, Any]) -> sp.Expr:
    """Translate the closed generated tree without parsing or evaluating strings.

    Args:
        node: One generated expression-tree node.
    """
    kind = node["kind"]
    if kind == "number":
        return sp.Rational(node["n"], node["d"])
    if kind == "symbol":
        return sp.Symbol(node["name"], real=True)
    if kind == "power":
        return expression(node["base"]) ** node["exponent"]
    if kind == "product":
        return sp.Mul(*(expression(part) for part in node["args"]))
    if kind == "sum":
        return sp.Add(*(expression(part) for part in node["args"]))
    if kind == "quotient":
        return expression(node["top"]) / expression(node["bottom"])
    raise ValueError(f"Unknown node: {kind}")


def denominator_symbols(node: dict[str, Any]) -> set[sp.Symbol]:
    """Find original denominator symbols before symbolic cancellation can erase them.

    Args:
        node: One generated expression-tree node.
    """
    result: set[sp.Symbol] = set()
    if node["kind"] == "quotient":
        result |= expression(node["bottom"]).free_symbols
        result |= denominator_symbols(node["top"])
        result |= denominator_symbols(node["bottom"])
    for part in node.get("args", []):
        result |= denominator_symbols(part)
    if node["kind"] == "power":
        result |= denominator_symbols(node["base"])
    return result


def main() -> None:
    """Check every family across both modes and each difficulty using exact identities."""
    source = """
      const c = require('./js/core.js'), tasks = [];
      for (const mode of c.MODES) for (const level of c.LEVELS) for (let seed=0; seed<30; seed++) {
        tasks.push(...c.generateSheet({schema:1,language:'de',mode,count:12,level,seed,revealed:[]}));
      }
      process.stdout.write(JSON.stringify(tasks));
    """
    tasks = json.loads(subprocess.run(["node", "-e", source], cwd=ROOT, check=True, capture_output=True, text=True).stdout)
    stages = 0
    families: set[str] = set()
    for task in tasks:
        variable = sp.Symbol(task["variable"], real=True)
        original = expression(task["expression"])
        answer = expression(task["standard"])
        coefficient = expression(task["coefficient"])
        assert sp.cancel(original - answer) == 0, task
        assert sp.cancel(answer - coefficient * variable ** task["degree"]) == 0, task
        assert variable not in coefficient.free_symbols, task
        assert coefficient != 0, task
        # The coefficient is a single nonzero rational times integer powers of
        # nonzero parameters, so it cannot vanish for any allowed assignment.
        assert all(base.is_Number or isinstance(base, sp.Symbol) for base in coefficient.as_powers_dict()), task
        assert (variable in denominator_symbols(task["expression"])) == task["excludedZero"], task
        if task["excludedZero"]:
            assert answer.subs(variable, 0) == 0, task
            assert any(step["rule"] == "cancel" for step in task["stages"]), task
        for step in task["stages"]:
            assert sp.cancel(original - expression(step["expression"])) == 0, (task, step)
            stages += 1
        families.add(task["family"])
    assert len(families) == 13
    print(f"Exact SymPy proofs passed: {len(tasks)} tasks, {stages} stages, {len(families)} families.")


if __name__ == "__main__":
    main()
