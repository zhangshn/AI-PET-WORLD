"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  fuzzyParameterMatch,
  trainingParameterCatalog,
  trainingParameterDictionaryMetadata,
} from "../_lib/training-parameter-catalog";
import type { TrainingStageDetail } from "../_lib/current-training-dashboard-types";
import { stageLabel } from "../_lib/training-stage-label";
import styles from "./page.module.css";

export function ParameterHelpCenter({
  initialTopic = null,
  compact = false,
  triggerLabel = null,
}: {
  initialTopic?: string | null;
  compact?: boolean;
  triggerLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(
    () =>
      trainingParameterCatalog.filter((item) =>
        fuzzyParameterMatch(item, query),
      ),
    [query],
  );
  function show(topic?: string) {
    setQuery(
      topic
        ? (trainingParameterCatalog.find((item) => item.id === topic)?.name ??
            topic)
        : "",
    );
    setOpen(true);
  }
  return (
    <>
      <button
        className={
          triggerLabel
            ? styles.parameterTermButton
            : compact
              ? styles.inlineHelpButton
              : styles.helpLauncher
        }
        data-testid={
          initialTopic
            ? `parameter-help-${initialTopic}`
            : "parameter-help-open"
        }
        onClick={() => show(initialTopic ?? undefined)}
        type="button"
      >
        {triggerLabel ? (
          <>
            <span>{triggerLabel}</span>
            <b>?</b>
          </>
        ) : (
          <>
            <span>?</span>
            <div>
              <strong>参数说明中心</strong>
              <small>本地模型数据字典 · 支持中英文模糊查询</small>
            </div>
          </>
        )}
      </button>
      {open ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            aria-label="本地自研AI模型数据字典"
            aria-modal="true"
            className={styles.helpDialog}
            role="dialog"
          >
            <header>
              <div>
                <span>LOCAL AI MODEL DATA DICTIONARY</span>
                <h2>本地自研AI模型数据字典</h2>
                <p>
                  统一解释模型、数据、训练、Checkpoint、严格复验、机器审核、Token、硬件和Owner治理字段。
                </p>
              </div>
              <button
                aria-label="关闭参数说明"
                onClick={() => setOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className={styles.dictionaryMeta}>
              <span>
                <b>{trainingParameterDictionaryMetadata.entryCount}</b> 个字段
              </span>
              <span>
                <b>{trainingParameterDictionaryMetadata.categories.length}</b> 个分类
              </span>
              <span>
                模型 <code>{trainingParameterDictionaryMetadata.modelId}</code>
              </span>
              <span>
                更新 {trainingParameterDictionaryMetadata.updatedAtAsiaShanghai}
              </span>
            </div>
            <label className={styles.helpSearch}>
              <span>模糊查询</span>
              <input
                autoFocus
                data-testid="parameter-help-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="例如：conditionLabel、seed、拒绝码、Token、显存……"
                type="search"
                value={query}
              />
            </label>
            <p className={styles.searchCount}>找到 {results.length} 个参数</p>
            <div className={styles.parameterResults}>
              {results.map((item) => (
                <article data-testid={`parameter-${item.id}`} key={item.id}>
                  <div className={styles.dictionaryTags}>
                    <span>{item.category}</span>
                    <span>{item.kind}</span>
                    <span>{item.dataType}</span>
                  </div>
                  <h3>{item.name}</h3>
                  <code>{item.code}</code>
                  <p>{item.plainLanguage}</p>
                  <small>{item.interpretation}</small>
                  <dl className={styles.dictionaryReadingRule}>
                    <div>
                      <dt>怎么看</dt>
                      <dd>{item.readingRule}</dd>
                    </div>
                    <div>
                      <dt>权威来源</dt>
                      <dd>{item.source}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
            {!results.length ? (
              <p className={styles.empty}>
                没有找到匹配参数。可以缩短关键词后重试。
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

export function TrainingRecordSelector({
  stages,
  selectedRunId,
  onSelectRun,
}: {
  stages: TrainingStageDetail[];
  selectedRunId?: string | null;
  onSelectRun?: (runId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = stages.filter((stage) => fuzzyStageMatch(stage, query));
  const selected =
    stages.find((stage) => stage.runId === selectedRunId) ??
    stages.at(-1) ??
    null;
  return (
    <div className={styles.recordSelector}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={styles.recordSelectorButton}
        data-testid="training-record-selector"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span>当前选择</span>
        <strong>{selected ? stageLabel(selected) : "没有训练记录"}</strong>
        <small>{selected?.runId ?? "--"}</small>
        <b>{open ? "收起" : "展开并搜索"}⌄</b>
      </button>
      {open ? (
        <div className={styles.recordDropdown}>
          <div className={styles.recordDropdownHeader}>
            <div>
              <span>TRAINING RECORD FINDER</span>
              <strong>查询Stage训练记录</strong>
            </div>
            <button
              aria-label="关闭训练记录查询"
              onClick={() => setOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>
          <label>
            <span>模糊查询训练记录</span>
            <input
              autoFocus
              data-testid="training-record-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Stage 2、1024、failed、Run ID……"
              type="search"
              value={query}
            />
          </label>
          <div
            aria-label="训练记录搜索结果"
            className={styles.recordOptions}
            role="listbox"
          >
            {filtered.map((stage, index) =>
              onSelectRun ? (
                <button
                  aria-selected={stage.runId === selected?.runId}
                  data-testid={`training-record-option-${index}`}
                  key={stage.runId}
                  onClick={() => {
                    onSelectRun(stage.runId);
                    setOpen(false);
                  }}
                  role="option"
                  type="button"
                >
                  <span>{stageLabel(stage)}</span>
                  <strong>{stage.status}</strong>
                  <small>
                    {stage.epochCount} epoch ·{" "}
                    {stage.createdAtAsiaShanghai ??
                      stage.createdAtUtc ??
                      "时间未知"}
                  </small>
                  <code>{stage.runId}</code>
                </button>
              ) : (
                <Link
                  aria-selected={stage.runId === selected?.runId}
                  data-testid={`training-record-option-${index}`}
                  href={`/ai-painter-progress/current-training/runs/${encodeURIComponent(stage.runId)}`}
                  key={stage.runId}
                  role="option"
                >
                  <span>{stageLabel(stage)}</span>
                  <strong>{stage.status}</strong>
                  <small>
                    {stage.epochCount} epoch ·{" "}
                    {stage.createdAtAsiaShanghai ??
                      stage.createdAtUtc ??
                      "时间未知"}
                  </small>
                  <code>{stage.runId}</code>
                </Link>
              ),
            )}
            {!filtered.length ? (
              <p className={styles.empty}>没有匹配的训练记录。</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function fuzzyStageMatch(stage: TrainingStageDetail, query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const fields = [
    stageLabel(stage),
    stage.runId,
    stage.status,
    stage.kind,
    stage.verdict,
    stage.resolution?.width,
    stage.resolution?.height,
    stage.epochCount,
  ].map((value) => String(value ?? "").toLowerCase());
  return terms.every((term) =>
    fields.some((field) => fuzzyFieldMatch(term, field)),
  );
}

function fuzzyFieldMatch(term: string, field: string) {
  if (field.includes(term)) return true;
  if (term.length < 3) return false;
  return field
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter(Boolean)
    .some(
      (word) =>
        Math.abs(word.length - term.length) <= 2 &&
        editDistance(word, term) <= (term.length > 6 ? 2 : 1),
    );
}
function editDistance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previous = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        previous + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[right.length];
}
