"use strict";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TIMEOUT_MS = 15000;
const LLM_USAGE_PHASES = [
  "技术响应中的语义负偏离、笼统表述和证明不足判断",
  "授权主体、注册人、被授权单位之间的关系解释与冲突提示",
  "规则引擎未覆盖的隐性矛盾、材料缺口和人工复核建议生成"
];

function getLlmConfig() {
  const baseUrl = normalizeBaseUrl(process.env.LLM_API_BASE_URL || DEFAULT_BASE_URL);
  const apiKey = String(process.env.LLM_API_KEY || "").trim();
  const model = String(process.env.LLM_MODEL || "").trim();
  const timeoutMs = toPositiveInt(process.env.LLM_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const missing = [];

  if (!apiKey) {
    missing.push("LLM_API_KEY");
  }

  if (!model) {
    missing.push("LLM_MODEL");
  }

  return {
    enabled: missing.length === 0,
    provider: "openai-compatible",
    providerLabel: "OpenAI 兼容推理服务",
    baseUrl,
    apiKey,
    model,
    timeoutMs,
    missing,
    usagePhases: LLM_USAGE_PHASES
  };
}

function getLlmCapability(config = getLlmConfig()) {
  return {
    configured: config.enabled,
    provider: config.provider,
    providerLabel: config.providerLabel,
    model: config.model || null,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    missing: config.missing,
    usagePhases: config.usagePhases
  };
}

async function reviewWithLlm({ projectName, documents, ruleResult, config = getLlmConfig() }) {
  if (!config.enabled) {
    throw new Error("LLM is not configured");
  }

  const requestBody = {
    model: config.model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: buildMessages(projectName, documents, ruleResult)
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    if (!response.ok) {
      const failureBody = await response.text();
      throw new Error(`LLM request failed: ${response.status} ${truncateText(failureBody, 240)}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("LLM response did not contain message content");
    }

    return normalizeAiReview(parseJsonPayload(content), config);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`LLM request timed out after ${config.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function buildMessages(projectName, documents, ruleResult) {
  const compactDocuments = documents.slice(0, 10).map((document) => ({
    name: document.name || "未命名材料",
    type: document.type || "unknown",
    excerpt: truncateText(String(document.content || ""), 1200)
  }));

  const compactRuleFindings = (ruleResult.findings || []).slice(0, 12).map((finding) => ({
    title: finding.title,
    severity: finding.severity,
    type: finding.type,
    location: finding.location,
    evidence: truncateText(finding.evidence || "", 240),
    recommendation: truncateText(finding.recommendation || "", 240)
  }));

  const userPayload = {
    projectName,
    keyFacts: ruleResult.keyFacts,
    ruleSummary: ruleResult.summary,
    ruleFindings: compactRuleFindings,
    documents: compactDocuments,
    focus: [
      "识别规则引擎难以覆盖的技术响应语义风险，例如笼统表述、功能不充分、疑似负偏离",
      "识别授权主体、注册人、被授权单位和产品型号之间的隐性矛盾",
      "给出需要人工复核的重点项目和补充材料建议"
    ]
  };

  return [
    {
      role: "system",
      content: [
        "你是医疗设备投标资格审查助手。",
        "你的任务不是重复规则引擎结论，而是在规则结果基础上做语义增强审查。",
        "仅输出 JSON，不要输出 Markdown。",
        "JSON 结构必须包含 summary、focus_areas、findings、manual_review_items。",
        "findings 每项包含 title、severity、type、location、evidence、recommendation。",
        "manual_review_items 每项包含 item、reason、suggested_material。",
        "severity 只能是 high、medium、low。"
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify(userPayload, null, 2)
    }
  ];
}

function normalizeAiReview(payload, config) {
  const findings = Array.isArray(payload.findings)
    ? payload.findings.map((item, index) => normalizeAiFinding(item, index))
    : [];

  const manualReviewItems = Array.isArray(payload.manual_review_items)
    ? payload.manual_review_items.map((item) => ({
      item: normalizeText(item.item || item.title || "待人工复核项"),
      reason: normalizeText(item.reason || "模型认为该项存在进一步核验必要。"),
      suggestedMaterial: normalizeText(item.suggested_material || item.suggestedMaterial || "请补充原始附件或证明材料。")
    }))
    : [];

  const focusAreas = Array.isArray(payload.focus_areas)
    ? payload.focus_areas.map((item) => normalizeText(item)).filter(Boolean)
    : [];

  return {
    status: "applied",
    provider: config.provider,
    providerLabel: config.providerLabel,
    model: config.model,
    summary: normalizeText(payload.summary || "模型已完成增强审查。"),
    focusAreas,
    findings,
    manualReviewItems
  };
}

function normalizeAiFinding(item, index) {
  const severity = ["high", "medium", "low"].includes(item?.severity) ? item.severity : "medium";
  return {
    id: `AI-${String(index + 1).padStart(3, "0")}`,
    source: "llm",
    title: normalizeText(item?.title || "模型识别到补充风险"),
    severity,
    type: normalizeText(item?.type || "模型增强审查"),
    location: normalizeText(item?.location || "全卷检查"),
    evidence: normalizeText(item?.evidence || "模型基于材料语义关系给出补充判断。"),
    recommendation: normalizeText(item?.recommendation || "建议人工复核并补充证明材料。")
  };
}

function parseJsonPayload(content) {
  try {
    return JSON.parse(content);
  } catch (error) {
    const fenceMatch = content.match(/```json\s*([\s\S]*?)```/i) || content.match(/```\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      return JSON.parse(fenceMatch[1]);
    }
    throw new Error("LLM response was not valid JSON");
  }
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateText(value, maxLength) {
  const normalized = normalizeText(value);
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

module.exports = {
  getLlmConfig,
  getLlmCapability,
  reviewWithLlm
};
