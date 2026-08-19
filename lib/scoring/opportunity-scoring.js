/**
 * Versioned Multi-Vertical Field Opportunity Scoring Engine
 * Incorporates GA Workbook economics + Census Housing + Storm Context
 */

export const VERTICAL_WEIGHTS = {
  roofing: {
    wHome: 0.18,
    wIntent: 0.18,
    wAtt: 0.14,
    wAccess: 0.12,
    wCost: 0.10,
    wHomeVal: 0.08,
    wHomeAge: 0.07,
    wStorm: 0.05,
    wROI: 0.04,
    wLeadTime: 0.04,
    jobValue: 19500,
    engagementRate: 0.06,
    qualifiedRate: 0.55,
    captureRate: 0.55,
    apptRate: 0.40,
    closeRate: 0.20,
    targetLeads: 60,
    targetCPL: 120,
    targetROI: 8,
  },
  windows_doors: {
    wHome: 0.20,
    wIntent: 0.20,
    wAtt: 0.14,
    wAccess: 0.10,
    wCost: 0.10,
    wHomeVal: 0.10,
    wHomeAge: 0.06,
    wStorm: 0.02,
    wROI: 0.05,
    wLeadTime: 0.03,
    jobValue: 14000,
    engagementRate: 0.07,
    qualifiedRate: 0.60,
    captureRate: 0.50,
    apptRate: 0.45,
    closeRate: 0.22,
    targetLeads: 50,
    targetCPL: 110,
    targetROI: 7,
  },
  gutters: {
    wHome: 0.18,
    wIntent: 0.15,
    wAtt: 0.18,
    wAccess: 0.12,
    wCost: 0.12,
    wHomeVal: 0.07,
    wHomeAge: 0.08,
    wStorm: 0.04,
    wROI: 0.04,
    wLeadTime: 0.02,
    jobValue: 4200,
    engagementRate: 0.09,
    qualifiedRate: 0.65,
    captureRate: 0.60,
    apptRate: 0.50,
    closeRate: 0.30,
    targetLeads: 80,
    targetCPL: 65,
    targetROI: 6,
  },
  solar: {
    wHome: 0.22,
    wIntent: 0.16,
    wAtt: 0.12,
    wAccess: 0.10,
    wCost: 0.10,
    wHomeVal: 0.14,
    wHomeAge: 0.04,
    wStorm: 0.02,
    wROI: 0.06,
    wLeadTime: 0.04,
    jobValue: 28000,
    engagementRate: 0.04,
    qualifiedRate: 0.45,
    captureRate: 0.45,
    apptRate: 0.35,
    closeRate: 0.18,
    targetLeads: 35,
    targetCPL: 180,
    targetROI: 9,
  }
};

const INTENT_TIERS = {
  "Home Show": 0.95,
  "Outdoor/Lifestyle Expo": 0.80,
  "Trade/Builder Event": 0.75,
  "County Fair/Festival": 0.60,
  "Community Event": 0.50,
  "Farmers Market": 0.55,
  "Estate/Yard Sale": 0.65,
  "Antique/Flea Market": 0.45,
};

export function scoreEvent(event, vertical = "roofing", overrides = {}) {
  const vCfg = { ...(VERTICAL_WEIGHTS[vertical] || VERTICAL_WEIGHTS.roofing), ...overrides };

  const att = Number(event.attendance?.estimated || event.att) || 5000;
  const lo = Number(event.attendance?.low || event.lo) || att * 0.8;
  const hi = Number(event.attendance?.high || event.hi) || att * 1.2;
  const hoPct = Number(event.attendance?.homeowner_pct != null ? event.attendance.homeowner_pct : (event.ho != null ? event.ho : 0.60));

  // Funnel
  const captureFactor = hoPct * vCfg.engagementRate * vCfg.qualifiedRate * vCfg.captureRate;
  const leadsExp = att * captureFactor;
  const leadsLo = lo * captureFactor;
  const leadsHi = hi * captureFactor;

  // Costs
  const boothCost = Number(event.vendor_opportunity?.booth_price_min || event.booth) || 800;
  const deposit = Number(event.vendor_opportunity?.deposit || 0);
  const electric = Number(event.vendor_opportunity?.electricity_fee || 0);
  const travel = Number(event.travel || 0);
  const staff = Number(event.staff || 0);
  const other = Number(event.other || 0);
  const totalCost = boothCost + deposit + electric + travel + staff + other;

  // Economics
  const cpl = leadsExp > 0 && totalCost > 0 ? totalCost / leadsExp : (totalCost === 0 ? 0 : 999);
  const revenue = leadsExp * vCfg.apptRate * vCfg.closeRate * vCfg.jobValue;
  const roi = totalCost > 0 ? revenue / totalCost : (leadsExp > 0 ? 99 : 0);

  // Sub-scores (0-100)
  const scoreHome = Math.min(100, hoPct * 100);
  const typeIntent = INTENT_TIERS[event.event_type || event.type] || 0.50;
  const scoreIntent = Math.min(100, typeIntent * 100);
  const scoreAtt = Math.min(100, (att / (vCfg.targetLeads * 300)) * 100);
  
  const vStatus = event.vendor_opportunity?.status || event.vStatus || "open";
  const scoreAccess = vStatus === "open" ? 100 : vStatus === "waitlist" ? 60 : vStatus === "invite_only" ? 40 : 10;
  const scoreCost = cpl === 0 ? 100 : Math.min(100, (vCfg.targetCPL / cpl) * 100);

  // Housing value score (e.g. $400k+ is 100)
  const homeValStr = String(event.housing_context?.median_home_value || event.homeVal || "350");
  const homeValNum = parseInt(homeValStr.replace(/[^0-9]/g, "")) || 350;
  const scoreHomeVal = Math.min(100, (homeValNum / 400) * 100);

  // Home age score (homes 15-35 yrs old need roofs)
  const homeAge = Number(event.housing_context?.median_home_age_years) || 20;
  const scoreHomeAge = (homeAge >= 15 && homeAge <= 35) ? 100 : (homeAge > 35 ? 85 : 50);

  // Storm relevance score
  const hasHail = Boolean(event.housing_context?.hail_history_6mo);
  const stormDist = event.housing_context?.storm_event_proximity_miles;
  const scoreStorm = hasHail || (stormDist && stormDist <= 15) ? 100 : (stormDist && stormDist <= 35 ? 70 : 30);

  const scoreROI = totalCost === 0 ? (leadsExp > 0 ? 100 : 0) : Math.min(100, (roi / vCfg.targetROI) * 100);

  // Weighted total
  const totalScore = (
    vCfg.wHome * scoreHome +
    vCfg.wIntent * scoreIntent +
    vCfg.wAtt * scoreAtt +
    vCfg.wAccess * scoreAccess +
    vCfg.wCost * scoreCost +
    vCfg.wHomeVal * scoreHomeVal +
    vCfg.wHomeAge * scoreHomeAge +
    vCfg.wStorm * scoreStorm +
    vCfg.wROI * scoreROI
  );

  const clampedScore = Math.max(0, Math.min(100, Math.round(totalScore * 10) / 10));
  const verdict = clampedScore >= 75 ? "Strongly Recommended" : (clampedScore >= 60 ? "Conditional" : "Not Recommended");

  return {
    total_score: clampedScore,
    verdict,
    projected_leads: {
      expected: Math.round(leadsExp * 10) / 10,
      low: Math.round(leadsLo * 10) / 10,
      high: Math.round(leadsHi * 10) / 10,
    },
    economics: {
      total_cost: totalCost,
      cpl: Math.round(cpl * 100) / 100,
      projected_revenue: Math.round(revenue),
      roi: Math.round(roi * 10) / 10,
    },
    sub_scores: {
      homeowner: Math.round(scoreHome),
      purchase_intent: Math.round(scoreIntent),
      attendance: Math.round(scoreAtt),
      vendor_access: Math.round(scoreAccess),
      cost_efficiency: Math.round(scoreCost),
      housing_wealth: Math.round(scoreHomeVal),
      housing_age: Math.round(scoreHomeAge),
      storm_relevance: Math.round(scoreStorm),
      roi_multiple: Math.round(scoreROI),
    }
  };
}
