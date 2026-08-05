// src/Component/Utils/ResultCalculator.jsx

/**
 * Parses test scores and calculates the term mean as the direct sum of T1 and T2
 * (matching AnnualBroadSheet).
 */
export const getTermScores = (
  gradesArray,
  pupilId,
  subj,
  termPrefix
) => {
  const getScore = (test) => {
    const record = gradesArray.find(
      (g) =>
        g.pupilID === pupilId &&
        g.subject === subj &&
        g.test === test
    );
    return Number(record?.grade || 0);
  };

  const t1 = getScore(`${termPrefix} T1`);
  const t2 = getScore(`${termPrefix} T2`);

  // Modified: Calculate sum (T1 + T2) directly without dividing by 2
  const rawMean = t1 + t2;
  const roundedMean = Math.round(rawMean);

  return {
    t1: Math.round(t1),
    t2: Math.round(t2),
    rawMean,
    mean: roundedMean, // Pre-rounded term total
  };
};

/**
 * Calculates Annual Subject Mean matching AnnualBroadSheet's exact logic.
 * Expects m1, m2, m3 to be pre-rounded integers or handles rounding inline.
 */
export const calculateAnnualMean = (
  term1 = 0,
  term2 = 0,
  term3 = 0,
  calcMode = "auto"
) => {
  // Ensure we are working with rounded integers for each term
  const m1 = Math.round(Number(term1) || 0);
  const m2 = Math.round(Number(term2) || 0);
  const m3 = Math.round(Number(term3) || 0);

  let divisor = 3;
  let scoreSum = m1 + m2 + m3;

  if (calcMode === "auto") {
    let activeTermsCount = 0;
    if (m1 > 0) activeTermsCount++;
    if (m2 > 0) activeTermsCount++;
    if (m3 > 0) activeTermsCount++;
    divisor = activeTermsCount > 0 ? activeTermsCount : 1;
  } else if (calcMode === "term1_2") {
    divisor = 2;
    scoreSum = m1 + m2;
  } else if (calcMode === "term2_3") {
    divisor = 2;
    scoreSum = m2 + m3;
  } else {
    divisor = Number(calcMode) || 3;
    scoreSum = m1 + m2 + m3;
  }

  // Final round of the sum divided by divisor
  return Math.round(scoreSum / divisor);
};

/**
 * Calculates subject term rankings with exact tie-breaking.
 */
export const calculateSubjectRanks = (
  gradesArray,
  pupilIDs,
  uniqueSubjects
) => {
  const ranks = {};

  uniqueSubjects.forEach((sub) => {
    ["Term 1", "Term 2", "Term 3"].forEach((term) => {
      const scores = pupilIDs
        .map((id) => {
          const score = getTermScores(gradesArray, id, sub, term).mean;
          return { id, score };
        })
        .sort((a, b) => b.score - a.score);

      const key = `${sub}_${term}`;
      ranks[key] = {};

      scores.forEach((s, index) => {
        if (index > 0 && s.score === scores[index - 1].score) {
          ranks[key][s.id] = ranks[key][scores[index - 1].id];
        } else {
          ranks[key][s.id] = index + 1;
        }
      });
    });
  });

  return ranks;
};

/**
 * Calculates subject annual ranks across pupils.
 */
export const calculateSubjectAnnualRanks = (
  gradesArray,
  pupilIDs,
  uniqueSubjects,
  calcMode = "auto"
) => {
  const result = {};

  uniqueSubjects.forEach((sub) => {
    const scores = pupilIDs
      .map((id) => {
        const m1 = getTermScores(gradesArray, id, sub, "Term 1").mean;
        const m2 = getTermScores(gradesArray, id, sub, "Term 2").mean;
        const m3 = getTermScores(gradesArray, id, sub, "Term 3").mean;

        return {
          id,
          annual: calculateAnnualMean(m1, m2, m3, calcMode),
        };
      })
      .sort((a, b) => b.annual - a.annual);

    result[sub] = {};

    scores.forEach((s, index) => {
      if (index > 0 && s.annual === scores[index - 1].annual) {
        result[sub][s.id] = result[sub][scores[index - 1].id];
      } else {
        result[sub][s.id] = index + 1;
      }
    });
  });

  return result;
};

/**
 * Overall Metrics Calculation
 * Accurately mimics allStudentsStats, footers, percentages, and class ranks from AnnualBroadSheet.
 */
export const calculateOverallMetrics = (
  gradesArray,
  pupilIDs,
  uniqueSubjects,
  selectedPupilId,
  calculationMode = "auto"
) => {
  const allStudentsStats = pupilIDs.map((id) => {
    let t1 = 0,
      t2 = 0,
      t3 = 0;
    let totalAnnualAccumulator = 0;

    uniqueSubjects.forEach((sub) => {
      const m1 = getTermScores(gradesArray, id, sub, "Term 1").mean;
      const m2 = getTermScores(gradesArray, id, sub, "Term 2").mean;
      const m3 = getTermScores(gradesArray, id, sub, "Term 3").mean;

      t1 += m1;
      t2 += m2;
      t3 += m3;

      const annMean = calculateAnnualMean(m1, m2, m3, calculationMode);
      totalAnnualAccumulator += annMean;
    });

    return { id, t1, t2, t3, annual: totalAnnualAccumulator };
  });

  const activePupilStats = allStudentsStats.find(
    (s) => s.id === selectedPupilId
  ) || { t1: 0, t2: 0, t3: 0, annual: 0 };

  const subjectCount = uniqueSubjects.length || 1;

  const getRank = (field) => {
    const sorted = [...allStudentsStats].sort((a, b) => b[field] - a[field]);
    const index = sorted.findIndex((s) => s.id === selectedPupilId);
    if (index === -1) return "—";

    if (index > 0 && sorted[index][field] === sorted[index - 1][field]) {
      return sorted.findIndex((s) => s[field] === sorted[index][field]) + 1;
    }
    return index + 1;
  };

  const termSummaries = {
    "Term 1": {
      total: activePupilStats.t1,
      percentage: (activePupilStats.t1 / subjectCount).toFixed(1),
      rank: getRank("t1"),
    },
    "Term 2": {
      total: activePupilStats.t2,
      percentage: (activePupilStats.t2 / subjectCount).toFixed(1),
      rank: getRank("t2"),
    },
    "Term 3": {
      total: activePupilStats.t3,
      percentage: (activePupilStats.t3 / subjectCount).toFixed(1),
      rank: getRank("t3"),
    },
  };

  const annualSummary = {
    total: activePupilStats.annual,
    avg: (activePupilStats.annual / subjectCount).toFixed(1),
    rank: getRank("annual"),
  };

  return {
    termSummaries,
    annualSummary,
    allStudentsStats,
  };
};