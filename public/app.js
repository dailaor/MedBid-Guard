const state = {
  documents: [],
  lastResult: null,
  capabilities: null
};

const elements = {
  projectName: document.getElementById("projectName"),
  fileInput: document.getElementById("fileInput"),
  loadSampleBtn: document.getElementById("loadSampleBtn"),
  manualTitle: document.getElementById("manualTitle"),
  manualContent: document.getElementById("manualContent"),
  addManualBtn: document.getElementById("addManualBtn"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  capabilityBanner: document.getElementById("capabilityBanner"),
  documentList: document.getElementById("documentList"),
  docCounter: document.getElementById("docCounter"),
  summaryCards: document.getElementById("summaryCards"),
  factChips: document.getElementById("factChips"),
  nextActions: document.getElementById("nextActions"),
  aiReview: document.getElementById("aiReview"),
  findingList: document.getElementById("findingList"),
  catalogTable: document.getElementById("catalogTable")
};

const TEXT_EXTENSIONS = new Set([".csv", ".html", ".json", ".log", ".md", ".text", ".txt", ".xml"]);

elements.fileInput.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) {
    return;
  }

  const loaded = [];
  for (const file of files) {
    loaded.push(await fileToDocument(file));
  }

  state.documents.push(...loaded);
  renderDocuments();
  elements.fileInput.value = "";
});

elements.loadSampleBtn.addEventListener("click", async () => {
  elements.loadSampleBtn.disabled = true;
  elements.loadSampleBtn.textContent = "载入中...";

  try {
    const response = await fetch("/examples/demo-bid-package.json");
    const payload = await response.json();
    elements.projectName.value = payload.projectName || elements.projectName.value;
    state.documents = payload.documents || [];
    state.lastResult = null;
    renderDocuments();
    renderResults(null);
  } catch (error) {
    alert(`示例包载入失败：${error.message}`);
  } finally {
    elements.loadSampleBtn.disabled = false;
    elements.loadSampleBtn.textContent = "载入示例包";
  }
});

elements.addManualBtn.addEventListener("click", () => {
  const title = elements.manualTitle.value.trim();
  const content = elements.manualContent.value.trim();

  if (!title || !content) {
    alert("请先填写材料标题和内容。");
    return;
  }

  state.documents.push({
    name: title,
    content,
    type: "manual/text",
    size: content.length
  });

  elements.manualTitle.value = "";
  elements.manualContent.value = "";
  renderDocuments();
});

elements.analyzeBtn.addEventListener("click", async () => {
  if (state.documents.length === 0) {
    alert("请先导入至少一份材料。");
    return;
  }

  elements.analyzeBtn.disabled = true;
  elements.analyzeBtn.textContent = "分析中...";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        projectName: elements.projectName.value.trim(),
        documents: state.documents
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "分析失败");
    }

    state.lastResult = payload;
    renderResults(payload);
  } catch (error) {
    alert(`分析失败：${error.message}`);
  } finally {
    elements.analyzeBtn.disabled = false;
    elements.analyzeBtn.textContent = "开始质检";
  }
});

renderDocuments();
renderResults(null);
loadCapabilities();

async function loadCapabilities() {
  try {
    const response = await fetch("/api/health");
    const payload = await response.json();
    state.capabilities = payload;
    renderCapabilityBanner(payload.llm);
  } catch (error) {
    elements.capabilityBanner.className = "capability-banner";
    elements.capabilityBanner.innerHTML = `
      <strong>推理服务状态读取失败</strong>
      <p>${escapeHtml(error.message)}</p>
    `;
  }
}

async function fileToDocument(file) {
  const extension = getExtension(file.name);
  const isTextLike = file.type.startsWith("text/") || TEXT_EXTENSIONS.has(extension);
  const content = isTextLike ? await file.text() : "";

  return {
    name: file.name,
    content,
    type: file.type || "application/octet-stream",
    size: file.size
  };
}

function renderCapabilityBanner(llm) {
  if (!llm) {
    elements.capabilityBanner.className = "capability-banner";
    elements.capabilityBanner.innerHTML = `
      <strong>未获取到推理服务配置</strong>
      <p>当前仅显示基础运行状态，未检测到可用的推理服务信息。</p>
    `;
    return;
  }

  const phases = (llm.usagePhases || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  if (llm.configured) {
    elements.capabilityBanner.className = "capability-banner";
    elements.capabilityBanner.innerHTML = `
      <strong>已配置模型增强</strong>
      <p>当前检测到 ${escapeHtml(llm.providerLabel)}，模型为 <code>${escapeHtml(llm.model || "unknown")}</code>。系统会在以下环节调用推理服务：</p>
      <ul>${phases}</ul>
    `;
    return;
  }

  const missing = (llm.missing || []).map((item) => `<code>${escapeHtml(item)}</code>`).join(" / ");
  elements.capabilityBanner.className = "capability-banner";
  elements.capabilityBanner.innerHTML = `
    <strong>当前运行模式：规则引擎</strong>
    <p>尚未检测到完整的推理服务配置。配置 ${missing || "<code>LLM_API_KEY</code> / <code>LLM_MODEL</code>"} 后，系统会在以下环节启用模型增强：</p>
    <ul>${phases}</ul>
  `;
}

function renderDocuments() {
  elements.docCounter.textContent = `${state.documents.length} 份`;
  if (state.documents.length === 0) {
    elements.documentList.className = "document-list empty-state";
    elements.documentList.textContent = "还没有材料，先载入示例或上传文本文件。";
    return;
  }

  elements.documentList.className = "document-list";
  elements.documentList.innerHTML = state.documents
    .map((document, index) => {
      const readableState = document.content && document.content.trim().length > 0 ? "可识别文本" : "需 OCR/人工复核";
      const readableClass = document.content && document.content.trim().length > 0 ? "status-ok" : "status-needs_review";
      const preview = escapeHtml((document.content || "当前未提取文本内容。").slice(0, 90));
      return `
        <article class="doc-card">
          <div>
            <h4>${escapeHtml(document.name)}</h4>
            <p>${preview}${(document.content || "").length > 90 ? "..." : ""}</p>
            <div class="doc-meta">
              <span class="status-tag ${readableClass}">${readableState}</span>
              <span class="tag">${formatFileSize(document.size || 0)}</span>
              <span class="tag">${escapeHtml(document.type || "unknown")}</span>
            </div>
          </div>
          <button class="ghost-button" type="button" data-remove-index="${index}">移除</button>
        </article>
      `;
    })
    .join("");

  elements.documentList.querySelectorAll("[data-remove-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.getAttribute("data-remove-index"));
      state.documents.splice(index, 1);
      renderDocuments();
    });
  });
}

function renderResults(result) {
  if (!result) {
    elements.summaryCards.className = "summary-grid empty-state";
    elements.summaryCards.textContent = "完成分析后，这里会显示风险总览。";
    elements.factChips.className = "chip-list empty-state";
    elements.factChips.textContent = "暂无数据";
    elements.nextActions.className = "action-list empty-state";
    elements.nextActions.textContent = "暂无数据";
    elements.aiReview.className = "empty-state";
    elements.aiReview.textContent = "当前尚未执行分析。";
    elements.findingList.className = "finding-list empty-state";
    elements.findingList.textContent = "暂无数据";
    elements.catalogTable.className = "catalog-table empty-state";
    elements.catalogTable.textContent = "暂无数据";
    return;
  }

  const { summary, keyFacts, nextActions, findings, structuredCatalog, pipeline, aiReview } = result;
  const llmStatusText = formatLlmStatus(pipeline?.llm);

  elements.summaryCards.className = "summary-grid";
  elements.summaryCards.innerHTML = [
    {
      label: "总体风险",
      value: summary.overallLevel,
      helper: summary.overview
    },
    {
      label: "审查模式",
      value: pipeline?.mode === "rule_plus_llm" ? "规则 + 模型" : "规则引擎",
      helper: llmStatusText
    },
    {
      label: "高风险问题",
      value: `${summary.highRiskCount} 项`,
      helper: "优先处理可能导致废标或资格不通过的问题。"
    },
    {
      label: "人工复核",
      value: `${summary.manualReviewCount} 份`,
      helper: "扫描件、图片件或文本过少材料会落到人工复核。"
    },
    {
      label: "结构化目录",
      value: `${summary.totalDocuments} 份`,
      helper: `共识别 ${summary.readableDocuments} 份可直接分析材料。`
    }
  ]
    .map((card) => `
      <article class="summary-card">
        <h4>${card.label}</h4>
        <strong>${card.value}</strong>
        <p>${card.helper}</p>
      </article>
    `)
    .join("");

  const factEntries = [
    ...decorateFactGroup("投标主体", keyFacts.companyNames),
    ...decorateFactGroup("产品名称", keyFacts.productNames),
    ...decorateFactGroup("型号规格", keyFacts.models),
    ...decorateFactGroup("注册证编号", keyFacts.registrationNumbers),
    ...decorateFactGroup("注册人/授权主体", keyFacts.registrants)
  ];

  elements.factChips.className = factEntries.length > 0 ? "chip-list" : "chip-list empty-state";
  elements.factChips.innerHTML = factEntries.length > 0
    ? factEntries.map((entry) => `<span class="fact-chip">${escapeHtml(entry)}</span>`).join("")
    : "暂无数据";

  elements.nextActions.className = nextActions.length > 0 ? "action-list" : "action-list empty-state";
  elements.nextActions.innerHTML = nextActions.length > 0
    ? nextActions.map((item) => `
        <article class="action-card">
          <header>
            <strong>${escapeHtml(item.priority)}</strong>
            <span class="tag">${escapeHtml(item.focus)}</span>
          </header>
          <p>${escapeHtml(item.action)}</p>
        </article>
      `).join("")
    : "暂无数据";

  renderAiReview(aiReview, pipeline?.llm);

  elements.findingList.className = findings.length > 0 ? "finding-list" : "finding-list empty-state";
  elements.findingList.innerHTML = findings.length > 0
    ? findings.map((finding) => `
        <article class="finding-card">
          <header>
            <div>
              <h4>${escapeHtml(finding.title)}</h4>
              <p>${escapeHtml(finding.type)} / ${escapeHtml(finding.location)}</p>
            </div>
            <span class="risk-chip risk-${finding.severity}">${severityLabel(finding.severity)}</span>
          </header>
          <p><strong>证据：</strong>${escapeHtml(finding.evidence)}</p>
          <p><strong>建议：</strong>${escapeHtml(finding.recommendation)}</p>
        </article>
      `).join("")
    : "暂无数据";

  elements.catalogTable.className = "catalog-table";
  elements.catalogTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>材料名称</th>
          <th>模块</th>
          <th>识别状态</th>
          <th>关键字段</th>
        </tr>
      </thead>
      <tbody>
        ${structuredCatalog.map((item) => `
          <tr>
            <td>
              <strong>${escapeHtml(item.name)}</strong>
              <div class="tag-row">
                ${(item.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
              </div>
            </td>
            <td>${escapeHtml(item.module)} / ${escapeHtml(item.category)}</td>
            <td>
              <span class="status-tag status-${escapeHtml(item.readStatus)}">${statusLabel(item.readStatus)}</span>
            </td>
            <td>${escapeHtml(compactFacts(item.extractedFacts))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderAiReview(aiReview, llm) {
  if (aiReview && aiReview.status === "applied") {
    const focusChips = (aiReview.focusAreas || []).map((item) => `<span class="fact-chip">${escapeHtml(item)}</span>`).join("");
    const findings = (aiReview.findings || []).map((finding) => `
      <article class="finding-card">
        <header>
          <div>
            <h4>${escapeHtml(finding.title)}</h4>
            <p>${escapeHtml(finding.type)} / ${escapeHtml(finding.location)}</p>
          </div>
          <span class="risk-chip risk-${finding.severity}">${severityLabel(finding.severity)}</span>
        </header>
        <p><strong>证据：</strong>${escapeHtml(finding.evidence)}</p>
        <p><strong>建议：</strong>${escapeHtml(finding.recommendation)}</p>
      </article>
    `).join("");
    const manualItems = (aiReview.manualReviewItems || []).map((item) => `
      <article class="manual-review-card">
        <h4>${escapeHtml(item.item)}</h4>
        <p><strong>原因：</strong>${escapeHtml(item.reason)}</p>
        <p><strong>建议补充：</strong>${escapeHtml(item.suggestedMaterial)}</p>
      </article>
    `).join("");

    elements.aiReview.className = "ai-review-wrap";
    elements.aiReview.innerHTML = `
      <article class="ai-summary-card">
        <h4>模型摘要</h4>
        <p>${escapeHtml(aiReview.summary)}</p>
      </article>
      <div class="chip-list">${focusChips || '<span class="fact-chip">模型未返回额外关注点</span>'}</div>
      <div class="finding-list">${findings || '<div class="empty-state">模型未识别到新增语义风险。</div>'}</div>
      <div class="manual-review-list">${manualItems || '<div class="empty-state">模型未返回额外人工复核项。</div>'}</div>
    `;
    return;
  }

  const phases = (llm?.usagePhases || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const statusText = llm?.status === "error"
    ? `推理服务调用失败：${escapeHtml(llm.error || "未知错误")}`
    : "当前未执行模型增强，系统仅展示规则引擎结论。";

  elements.aiReview.className = "empty-state";
  elements.aiReview.innerHTML = `
    <div>
      <p>${statusText}</p>
      <p class="subtle-note">配置推理服务后，模型将主要参与以下环节：</p>
      <ul>${phases}</ul>
    </div>
  `;
}

function decorateFactGroup(label, values) {
  return (values || []).map((value) => `${label}：${value}`);
}

function compactFacts(facts) {
  const chunks = [];
  if (facts.companyNames?.length) chunks.push(`主体 ${facts.companyNames.join(" / ")}`);
  if (facts.productNames?.length) chunks.push(`产品 ${facts.productNames.join(" / ")}`);
  if (facts.models?.length) chunks.push(`型号 ${facts.models.join(" / ")}`);
  if (facts.registrationNumbers?.length) chunks.push(`编号 ${facts.registrationNumbers.join(" / ")}`);
  if (facts.expiryDates?.length) chunks.push(`有效期 ${facts.expiryDates.join(" / ")}`);
  return chunks.join("；") || "未提取到关键字段";
}

function statusLabel(status) {
  if (status === "ok") return "可直接审查";
  if (status === "partial") return "文本偏少";
  return "需 OCR/人工复核";
}

function severityLabel(severity) {
  if (severity === "high") return "高风险";
  if (severity === "medium") return "中风险";
  return "低风险";
}

function formatLlmStatus(llm) {
  if (!llm) {
    return "未读取到推理服务状态。";
  }

  if (llm.status === "applied") {
    return `已调用 ${llm.providerLabel}（${llm.model || "unknown"}）完成语义增强审查。`;
  }

  if (llm.status === "error") {
    return `推理服务调用失败，已回退到规则引擎：${llm.error || "未知错误"}`;
  }

  if (llm.configured) {
    return `已检测到 ${llm.providerLabel} 配置。`;
  }

  return "未配置推理服务，当前仅运行规则引擎。";
}

function getExtension(filename) {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index).toLowerCase() : "";
}

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
