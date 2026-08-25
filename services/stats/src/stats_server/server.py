"""
Stats Verifier MCP server (stdio).

Tools the harness/Verifier call to gate every claimed finding:
  - two_proportion_test : is there real incremental lift in a holdout experiment?
  - cuped_uplift        : variance-reduced uplift using a pre-experiment covariate
  - assess_seasonality  : is an elevated window a real change or just seasonality? (STL)
  - baseline_zscore     : how unusual is a value vs a historical baseline?
  - power_analysis      : is the experiment powered to detect the effect?
  - verify_lift_claim   : combined verdict (real_lift / no_significant_lift / underpowered)

Run: `uv run stats-server` (stdio).
"""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import FastMCP

from . import stats

mcp = FastMCP("lift-stats")


@mcp.tool()
def two_proportion_test(conv_t: float, n_t: int, conv_c: float, n_c: int) -> dict[str, Any]:
    """Two-proportion z-test: incremental lift (abs/rel), 95% CI, p-value, significance."""
    return stats.two_proportion_test(conv_t, n_t, conv_c, n_c)


@mcp.tool()
def cuped_uplift(
    y_t: list[float], x_t: list[float], y_c: list[float], x_c: list[float]
) -> dict[str, Any]:
    """CUPED variance-reduced uplift using pre-experiment covariate x (per unit)."""
    return stats.cuped_uplift(y_t, x_t, y_c, x_c)


@mcp.tool()
def baseline_zscore(value: float, history: list[float]) -> dict[str, Any]:
    """z-score of a value vs a historical baseline; flags anomalies (|z|>2)."""
    return stats.baseline_zscore(value, history)


@mcp.tool()
def assess_seasonality(
    series: list[float], period: int, window_start: int, window_end: int
) -> dict[str, Any]:
    """STL-decompose; decide if an elevated window is 'real_change' or 'explained_by_seasonality'."""
    return stats.assess_seasonality(series, period, window_start, window_end)


@mcp.tool()
def power_analysis(n_t: int, n_c: int, baseline_rate: float, mde: float) -> dict[str, Any]:
    """Is the experiment powered (>=0.8) to detect an absolute effect of size `mde`?"""
    return stats.power_analysis(n_t, n_c, baseline_rate, mde)


@mcp.tool()
def verify_lift_claim(conv_t: float, n_t: int, conv_c: float, n_c: int, mde: float = 0.03) -> dict[str, Any]:
    """Combined gate for a holdout lift claim - the Verifier's main statistical check.

    Verdict:
      - 'real_lift'           : significant positive incremental lift (CI excludes 0)
      - 'no_significant_lift' : CI includes 0 (the trap / null / near-miss)

    Also reports `power`/`powered` so the Verifier can flag an under-powered null honestly.
    """
    test = stats.two_proportion_test(conv_t, n_t, conv_c, n_c)
    power = stats.power_analysis(n_t, n_c, conv_c / n_c if n_c else 0.0, mde)
    if test["significant"] and test["abs_lift"] > 0:
        verdict = "real_lift"
        reason = f"Significant +{test['abs_lift']:.1%} incremental lift (p={test['p_value']:.3f}, 95% CI excludes 0)."
    else:
        verdict = "no_significant_lift"
        powered_note = "" if power["powered"] else f" (note: power={power['power']:.2f} to detect a {mde:.0%} effect)"
        reason = (
            f"Raw conversion {test['p_treatment']:.1%} but incremental lift {test['abs_lift']:+.1%} "
            f"is not significant (p={test['p_value']:.3f}, 95% CI "
            f"[{test['ci95'][0]:+.1%}, {test['ci95'][1]:+.1%}] includes 0){powered_note}."
        )
    return {"verdict": verdict, "reason": reason, **test, "power": power["power"], "powered": power["powered"]}


def main() -> None:
    mcp.run()  # stdio transport by default


if __name__ == "__main__":
    main()
