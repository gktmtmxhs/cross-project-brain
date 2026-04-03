import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  normalizeEntry,
  queueLearning,
  resolveLearningPath,
} from "../scripts/cpb-log-learning.mjs";

test("resolveLearningPath derives a role path from skill, topic, and lesson", () => {
  const neuronPath = resolveLearningPath({
    skill: "ui-ux-pro-max",
    topic: "tokens",
    lesson: "status_badge_contrast",
    summary: "keep badge contrast readable",
  });

  assert.equal(neuronPath, "cortex/design/tokens/status_badge_contrast");
});

test("resolveLearningPath inserts surface and env before topic when provided", () => {
  const neuronPath = resolveLearningPath({
    role: "frontend",
    surface: "web",
    env: "browser",
    topic: "rendering",
    lesson: "defer_below_fold_chart",
    summary: "defer below-fold chart rendering",
  });

  assert.equal(neuronPath, "cortex/frontend/web/browser/rendering/defer_below_fold_chart");
});

test("normalizeEntry defaults to general role when only lesson metadata is provided", () => {
  const entry = normalizeEntry({
    lesson: "shrink_verification_scope",
    summary: "shrink verification to touched files",
  });

  assert.equal(entry.role, "general");
  assert.equal(entry.path, "cortex/general/patterns/shrink_verification_scope");
  assert.equal(entry.scope, "project");
});

test("queueLearning writes normalized role-aware entries to the inbox", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-log-learning-"));
  const localInboxPath = path.join(tmpRoot, "corrections.jsonl");

  const entry = queueLearning(
    {
      skill: "frontend-developer",
      topic: "performance",
      lesson: "avoid_full_page_spinner",
      scope: "global",
      summary: "replace full-page spinner with narrow pending state",
      problem: "whole page flickered during small query refresh",
      fix: "use narrow loading boundary",
    },
    localInboxPath,
  );

  const lines = fs.readFileSync(localInboxPath, "utf8").trim().split("\n");
  assert.equal(lines.length, 1);

  const parsed = JSON.parse(lines[0]);
  assert.equal(entry.path, "cortex/frontend/performance/avoid_full_page_spinner");
  assert.equal(parsed.path, "cortex/frontend/performance/avoid_full_page_spinner");
  assert.equal(parsed.role, "frontend");
  assert.equal(parsed.scope, "global");
});

test("normalizeEntry maps reality-checker skill into platform role", () => {
  const entry = normalizeEntry({
    skill: "reality-checker",
    topic: "observability",
    lesson: "attach_dashboard_to_release_claim",
    summary: "link the dashboard before calling a release healthy",
  });

  assert.equal(entry.role, "platform");
  assert.equal(entry.path, "cortex/platform/observability/attach_dashboard_to_release_claim");
});

test("normalizeEntry normalizes surface and env aliases", () => {
  const entry = normalizeEntry({
    role: "platform",
    surface: "app",
    env: "Ubuntu",
    topic: "operations",
    lesson: "refresh_service_after_secret_rotation",
    summary: "refresh service after rotating a secret",
  });

  assert.equal(entry.surface, "mobile");
  assert.equal(entry.env, "linux");
  assert.equal(entry.path, "cortex/platform/mobile/linux/operations/refresh_service_after_secret_rotation");
});

test("normalizeEntry preserves device scope for machine-only lessons", () => {
  const entry = normalizeEntry({
    role: "platform",
    topic: "operations",
    lesson: "refresh_audio_service_after_usb_switch",
    scope: "device",
    summary: "refresh the local audio service after switching USB devices",
  });

  assert.equal(entry.scope, "device");
  assert.equal(entry.role, "platform");
  assert.equal(entry.path, "cortex/platform/operations/refresh_audio_service_after_usb_switch");
});

test("normalizeEntry defaults shared lessons to English metadata", () => {
  const entry = normalizeEntry({
    skill: "frontend-developer",
    topic: "performance",
    lesson: "avoid_full_page_spinner",
    summary: "replace full-page spinner with narrow pending state",
  });

  assert.equal(entry.audience, "shared");
  assert.equal(entry.language, "en");
});

test("normalizeEntry infers hiring audience and Korean language for interview-style topics", () => {
  const entry = normalizeEntry({
    role: "general",
    topic: "interview",
    lesson: "explain_tradeoff_clearly",
    summary: "explain the tradeoff in a way suitable for interview storytelling",
  });

  assert.equal(entry.audience, "hiring");
  assert.equal(entry.language, "ko");
});

test("normalizeEntry honors explicit audience and language overrides", () => {
  const entry = normalizeEntry({
    role: "content",
    topic: "case_study",
    lesson: "rewrite_incident_story_for_public_post",
    audience: "shared",
    language: "EN",
    summary: "rewrite the incident story for a public engineering post",
  });

  assert.equal(entry.audience, "shared");
  assert.equal(entry.language, "en");
});
