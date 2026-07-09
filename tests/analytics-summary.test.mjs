import assert from "node:assert/strict";
import test from "node:test";
import { classifyVisitorSource, summarizeAnalytics } from "../scripts/analytics-summary.mjs";

test("classifies visitor sources from metadata and referrers", () => {
  assert.equal(classifyVisitorSource({ source: "newsletter", metadata: { source: "qr-code" } }), "newsletter");
  assert.equal(classifyVisitorSource({ metadata: { source: "qr-code" } }), "qr-code");
  assert.equal(classifyVisitorSource({ referrer: "https://www.google.com/search?q=bits" }), "google");
  assert.equal(classifyVisitorSource({ referrer: "https://l.facebook.com/" }), "facebook");
  assert.equal(classifyVisitorSource({ referrer: "" }), "direct");
});

test("summarizes activity, page views, shares, pages, and sources", () => {
  const summary = summarizeAnalytics([
    { event_type: "page_view", page_path: "/", visitor_id: "a", referrer: "", metadata: {}, created_at: "2026-07-08T10:00:00Z" },
    { event_type: "page_view", page_path: "/menu", visitor_id: "b", referrer: "https://www.google.com/", metadata: {}, created_at: "2026-07-08T11:00:00Z" },
    { event_type: "social_share_click", page_path: "/", visitor_id: "a", referrer: "", metadata: { platform: "facebook" }, created_at: "2026-07-09T12:00:00Z" },
    { event_type: "menu_modal_open", page_path: "/", visitor_id: "a", referrer: "", metadata: { item: "Breakfast Plates" }, created_at: "2026-07-09T13:00:00Z" }
  ]);

  assert.equal(summary.totalPageViews, 2);
  assert.equal(summary.uniqueVisitors, 2);
  assert.equal(summary.totalShares, 1);
  assert.deepEqual(summary.visitorSources, [{ source: "direct", count: 1 }, { source: "google", count: 1 }]);
  assert.deepEqual(summary.activityTypes, [
    { eventType: "page_view", count: 2 },
    { eventType: "social_share_click", count: 1 },
    { eventType: "menu_modal_open", count: 1 }
  ]);
  assert.equal(summary.activityByDay.find((day) => day.date === "2026-07-09").total, 2);
});
