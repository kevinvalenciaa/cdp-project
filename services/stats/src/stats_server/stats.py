"""
Pure statistical functions for the Stats Verifier.

These are the load-bearing math behind the Verifier's "you may not assert a trend
unless the numbers support it" gate. They are deliberately simple and inspectable,
and validated against planted ground truth in tests/.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from scipy import stats as sps


def two_proportion_test(
    conv_t: float, n_t: int, conv_c: float, n_c: int, alpha: float = 0.05
) -> dict[str, Any]:
    """Two-proportion z-test for a treatment vs holdout conversion experiment.

    Returns the absolute/relative incremental lift, a 95% CI, p-value, and whether
    the lift is statistically significant (the core 'is there real incremental lift?').
    """
    if n_t <= 0 or n_c <= 0:
        raise ValueError("n_t and n_c must be positive")
    p_t = conv_t / n_t
    p_c = conv_c / n_c
    lift = p_t - p_c

    # Unpooled SE for the confidence interval around the lift.
    se = float(np.sqrt(p_t * (1 - p_t) / n_t + p_c * (1 - p_c) / n_c))
    z_crit = float(sps.norm.ppf(1 - alpha / 2))
    ci_low, ci_high = lift - z_crit * se, lift + z_crit * se

    # Pooled SE for the hypothesis test (H0: equal proportions).
    p_pool = (conv_t + conv_c) / (n_t + n_c)
    se_pool = float(np.sqrt(p_pool * (1 - p_pool) * (1 / n_t + 1 / n_c)))
    z = lift / se_pool if se_pool > 0 else 0.0
    p_value = float(2 * (1 - sps.norm.cdf(abs(z))))
    ci_excludes_zero = not (ci_low <= 0 <= ci_high)
    significant = bool(p_value < alpha and ci_excludes_zero)

    return {
        "p_treatment": p_t,
        "p_control": p_c,
        "abs_lift": lift,
        "rel_lift": (lift / p_c) if p_c > 0 else None,
        "ci95": [ci_low, ci_high],
        "z": z,
        "p_value": p_value,
        "ci_excludes_zero": ci_excludes_zero,
        "significant": significant,
        "n_treatment": int(n_t),
        "n_control": int(n_c),
    }


def cuped_uplift(
    y_t: list[float], x_t: list[float], y_c: list[float], x_c: list[float], alpha: float = 0.05
) -> dict[str, Any]:
    """CUPED variance-reduced uplift estimate using a pre-experiment covariate x.

    theta = cov(x, y) / var(x) estimated on the pooled sample; y_adj = y - theta*(x - xbar).
    Returns the adjusted lift, CI, p-value, and the variance reduction vs the naive estimate.
    Works for binary (0/1) or continuous outcomes (e.g., revenue).
    """
    yt, xt, yc, xc = map(lambda a: np.asarray(a, dtype=float), (y_t, x_t, y_c, x_c))
    if len(yt) < 2 or len(yc) < 2:
        raise ValueError("need >=2 observations per arm")

    y_all = np.concatenate([yt, yc])
    x_all = np.concatenate([xt, xc])
    var_x = float(np.var(x_all, ddof=1))
    theta = float(np.cov(x_all, y_all, ddof=1)[0, 1] / var_x) if var_x > 0 else 0.0
    xbar = float(np.mean(x_all))

    yt_adj = yt - theta * (xt - xbar)
    yc_adj = yc - theta * (xc - xbar)

    def diff_ci(a: np.ndarray, b: np.ndarray) -> dict[str, Any]:
        lift = float(np.mean(a) - np.mean(b))
        se = float(np.sqrt(np.var(a, ddof=1) / len(a) + np.var(b, ddof=1) / len(b)))
        # Welch df
        res = sps.ttest_ind(a, b, equal_var=False)
        z_crit = float(sps.norm.ppf(1 - alpha / 2))
        return {
            "lift": lift,
            "ci95": [lift - z_crit * se, lift + z_crit * se],
            "p_value": float(res.pvalue),
            "se": se,
        }

    naive = diff_ci(yt, yc)
    adjusted = diff_ci(yt_adj, yc_adj)
    var_reduction = 1 - (adjusted["se"] ** 2) / (naive["se"] ** 2) if naive["se"] > 0 else 0.0
    adjusted_excludes_zero = not (adjusted["ci95"][0] <= 0 <= adjusted["ci95"][1])

    return {
        "theta": theta,
        "naive_lift": naive["lift"],
        "naive_ci95": naive["ci95"],
        "naive_p_value": naive["p_value"],
        "cuped_lift": adjusted["lift"],
        "cuped_ci95": adjusted["ci95"],
        "cuped_p_value": adjusted["p_value"],
        "variance_reduction": float(var_reduction),
        "ci_excludes_zero": adjusted_excludes_zero,
        "significant": bool(adjusted["p_value"] < alpha and adjusted_excludes_zero),
    }


def baseline_zscore(value: float, history: list[float]) -> dict[str, Any]:
    """How unusual is `value` vs a historical baseline? z = (value - mean) / std."""
    h = np.asarray(history, dtype=float)
    if len(h) < 2:
        raise ValueError("need >=2 history points")
    mean = float(np.mean(h))
    std = float(np.std(h, ddof=1))
    z = (value - mean) / std if std > 0 else 0.0
    return {
        "value": float(value),
        "baseline_mean": mean,
        "baseline_std": std,
        "z": float(z),
        "is_anomaly": bool(abs(z) > 2.0),
    }


def assess_seasonality(
    series: list[float], period: int, window_start: int, window_end: int
) -> dict[str, Any]:
    """STL-decompose a series and decide whether an elevated window reflects a REAL
    change in behavior or just SEASONALITY.

    Compares the window-vs-rest change in the raw series against the same change in the
    seasonally-adjusted series. If the raw elevation largely disappears after removing
    the seasonal component, the verdict is 'explained_by_seasonality'.
    """
    from statsmodels.tsa.seasonal import STL  # imported lazily (heavy)

    y = np.asarray(series, dtype=float)
    n = len(y)
    if n < 2 * period:
        raise ValueError(f"series too short for period={period} (need >= {2 * period})")
    window_end = min(window_end, n)
    if not (0 <= window_start < window_end <= n):
        raise ValueError("invalid window")

    res = STL(y, period=period, robust=True).fit()
    trend = np.asarray(res.trend)
    seasonal = np.asarray(res.seasonal)
    resid = np.asarray(res.resid)

    mask = np.zeros(n, dtype=bool)
    mask[window_start:window_end] = True

    # Measure the window's elevation above its OWN LOCAL TREND (so a growth trend is not
    # mistaken for seasonality), and ask how much of that elevation is the seasonal component.
    raw_dev = float(np.mean(y[mask] - trend[mask]))
    seasonal_dev = float(np.mean(seasonal[mask]))
    resid_std = float(np.std(resid))
    frac_seasonal = abs(seasonal_dev) / (abs(raw_dev) + 1e-9)

    rest = ~mask
    raw_change = float(np.mean(y[mask]) / np.mean(y[rest]) - 1) if rest.any() and np.mean(y[rest]) != 0 else 0.0

    var_resid = float(np.var(resid))
    var_seasonal_resid = float(np.var(seasonal + resid))
    seasonal_strength = max(0.0, 1 - var_resid / var_seasonal_resid) if var_seasonal_resid > 0 else 0.0

    # The window's elevation-above-trend is seasonal if the seasonal component explains
    # most of it (and the elevation is meaningfully above residual noise).
    explained = frac_seasonal > 0.6 and abs(raw_dev) > 1.0 * resid_std
    verdict = "explained_by_seasonality" if explained else "real_change"

    return {
        "raw_change": raw_change,
        "deviation_above_trend": raw_dev,
        "seasonal_contribution": seasonal_dev,
        "frac_explained_by_seasonality": frac_seasonal,
        "seasonal_strength": seasonal_strength,
        "resid_std": resid_std,
        "verdict": verdict,
        "explanation": (
            f"Window sits {raw_dev:+.0f} above its local trend; the seasonal component contributes "
            f"{seasonal_dev:+.0f} ({frac_seasonal * 100:.0f}% of it). Seasonal strength {seasonal_strength:.2f}."
        ),
    }


def power_analysis(
    n_t: int, n_c: int, baseline_rate: float, mde: float, alpha: float = 0.05
) -> dict[str, Any]:
    """Is the experiment powered to detect an absolute effect of size `mde`?"""
    p1 = baseline_rate
    p2 = min(0.999, max(0.001, baseline_rate + mde))
    se = float(np.sqrt(p1 * (1 - p1) / n_t + p2 * (1 - p2) / n_c))
    z_alpha = float(sps.norm.ppf(1 - alpha / 2))
    power = float(sps.norm.cdf(abs(mde) / se - z_alpha)) if se > 0 else 0.0
    ratio = min(n_t, n_c) / max(n_t, n_c) if max(n_t, n_c) > 0 else 0.0
    return {
        "power": power,
        "powered": bool(power >= 0.8),
        "arm_balance_ratio": ratio,
        "balanced": bool(ratio >= 0.2),  # not wildly imbalanced
        "mde": mde,
    }
