export function classifyVisitorSource(event = {}) {
  if (event.source) return event.source;
  const metadata = event.metadata || {};
  if (metadata.source) return metadata.source;

  const referrer = String(event.referrer || "").toLowerCase();
  if (!referrer) return "direct";
  if (referrer.includes("google.")) return "google";
  if (referrer.includes("facebook.") || referrer.includes("fb.")) return "facebook";
  if (referrer.includes("instagram.")) return "instagram";
  if (referrer.includes("tiktok.")) return "tiktok";
  if (referrer.includes("bing.") || referrer.includes("yahoo.") || referrer.includes("duckduckgo.")) return "search";
  return "referral";
}

export function summarizeAnalytics(events = []) {
  const pageViews = events.filter((event) => event.event_type === "page_view");
  const shareClicks = events.filter((event) => event.event_type === "social_share_click");
  const uniqueVisitors = new Set(pageViews.map((event) => event.visitor_id).filter(Boolean)).size;

  const trafficByDay = countBy(pageViews, (event) => event.created_at?.slice(0, 10));
  const activityByDay = countNestedBy(events, (event) => event.created_at?.slice(0, 10), (event) => event.event_type || "unknown");
  const topPages = countBy(pageViews, (event) => event.page_path || "/");
  const visitorSources = countBy(pageViews, classifyVisitorSource);
  const activityTypes = countBy(events, (event) => event.event_type || "unknown");

  return {
    totalPageViews: pageViews.length,
    uniqueVisitors,
    totalShares: shareClicks.length,
    fbShares: shareClicks.filter((event) => event.metadata?.platform === "facebook").length,
    waShares: shareClicks.filter((event) => event.metadata?.platform === "whatsapp").length,
    trafficByDay: toSortedSeries(trafficByDay, "date"),
    activityByDay: toSortedNestedSeries(activityByDay, "date"),
    topPages: toRankedSeries(topPages, "path", 10),
    visitorSources: toRankedSeries(visitorSources, "source", 10),
    activityTypes: toRankedSeries(activityTypes, "eventType", 10),
    events,
    recentEvents: [...events].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 25)
  };
}

function countBy(rows, keyFn) {
  const counts = {};
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function countNestedBy(rows, keyFn, seriesFn) {
  const counts = {};
  rows.forEach((row) => {
    const key = keyFn(row);
    const series = seriesFn(row);
    if (!key || !series) return;
    counts[key] = counts[key] || {};
    counts[key][series] = (counts[key][series] || 0) + 1;
  });
  return counts;
}

function toSortedSeries(counts, keyName) {
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({ [keyName]: key, count }));
}

function toSortedNestedSeries(counts, keyName) {
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => ({ [keyName]: key, ...values, total: Object.values(values).reduce((sum, value) => sum + value, 0) }));
}

function toRankedSeries(counts, keyName, limit) {
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([key, count]) => ({ [keyName]: key, count }));
}
