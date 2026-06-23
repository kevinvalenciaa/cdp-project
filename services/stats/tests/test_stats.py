"""Validates the Stats Verifier against the labeled eval set + targeted cases.

These mirror the planted ground truth: the verifier must call real lifts 'real_lift'
and never call a null/trap/near-miss 'real_lift' (no false positives), and STL must
flag a seasonal spike as 'explained_by_seasonality'.
"""

import json
from pathlib import Path

import numpy as np
import pytest

from stats_server import stats
from stats_server.server import verify_lift_claim

EVAL_FILE = Path(__file__).parent.parent / "evals" / "labeled_cases.jsonl"


def load_cases():
    return [json.loads(line) for line in EVAL_FILE.read_text().splitlines() if line.strip()]


@pytest.mark.parametrize("case", load_cases(), ids=lambda c: c["case"])
def test_lift_verdicts_match_labels(case):
    res = verify_lift_claim(case["conv_t"], case["n_t"], case["conv_c"], case["n_c"])
    assert res["verdict"] == case["label"], f"{case['case']}: {res['reason']}"


def test_trap_has_high_conversion_but_no_lift():
    # VIP trap: ~42% raw conversion, ~0 incremental lift -> must NOT be real_lift.
    res = verify_lift_claim(162, 385, 132, 315)
    assert res["p_treatment"] > 0.3
    assert res["verdict"] == "no_significant_lift"
    assert res["ci95"][0] <= 0 <= res["ci95"][1]


def _seasonal_series(n=120, period=12, amp=0.4, base=100.0):
    rng = np.random.default_rng(0)
    t = np.arange(n)
    seasonal = amp * np.cos(2 * np.pi * (t - 10) / period)
    return base * (1 + seasonal) + rng.normal(0, 2, n)


def test_seasonal_spike_explained_by_seasonality():
    series = _seasonal_series()
    # Window = the recurring peak of the last cycle (months ~9–11).
    res = stats.assess_seasonality(series.tolist(), period=12, window_start=105, window_end=108)
    assert res["raw_change"] > 0.2  # raw window looks elevated
    assert res["verdict"] == "explained_by_seasonality", res["explanation"]


def test_real_level_shift_is_real_change():
    series = _seasonal_series()
    series[108:] += 35  # permanent level shift (a genuine behavior change)
    res = stats.assess_seasonality(series.tolist(), period=12, window_start=108, window_end=120)
    assert res["verdict"] == "real_change", res["explanation"]


def test_cuped_reduces_variance():
    rng = np.random.default_rng(1)
    n = 500
    x_t, x_c = rng.normal(0, 1, n), rng.normal(0, 1, n)
    y_t = 0.5 * x_t + rng.normal(0, 1, n) + 0.2  # +0.2 treatment effect, covariate correlated
    y_c = 0.5 * x_c + rng.normal(0, 1, n)
    res = stats.cuped_uplift(y_t.tolist(), x_t.tolist(), y_c.tolist(), x_c.tolist())
    assert res["variance_reduction"] > 0.05
    assert res["cuped_lift"] > 0


def test_baseline_zscore_flags_anomaly():
    assert stats.baseline_zscore(150, [100, 102, 98, 101, 99])["is_anomaly"]
    assert not stats.baseline_zscore(101, [100, 102, 98, 101, 99])["is_anomaly"]


def test_power_analysis():
    assert stats.power_analysis(2000, 2000, 0.10, 0.05)["powered"]
    assert not stats.power_analysis(50, 50, 0.10, 0.02)["powered"]
