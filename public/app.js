const state = {
  documents: [],
  lastResult: null
};

const elements = {
  projectName: document.getElementById("projectName"),
  fileInput: document.getElementById("fileInput"),
  loadSampleBtn: document.getElementById("loadSampleBtn"),
  manualTitle: document.getElementById("manualTitle"),
  manualContent: document.getElementById("manualContent"),
  addManualBtn: document.getElementById("addManualBtn"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  documentList: document.getElementById("documentList"),
  docCounter: document.getElementById("docCounter"),
  summaryCards: document.getElementById("summaryCards"),
  factChips: document.getElementById("factChips"),
  nextActions: document.getElementById("nextActions"),
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
    elements.findingList.className = "finding-list empty-state";
    elements.findingList.textContent = "暂无数据";
    elements.catalogTable.className = "catalog-table empty-state";
    elements.catalogTable.textContent = "暂无数据";
    return;
  }

  const { summary, keyFacts, nextActions, findings, structuredCatalog } = result;
  elements.summaryCards.className = "summary-grid";
  elements.summaryCards.innerHTML = [
    {
      label: "总体风险",
      value: summary.overallLevel,
      helper: summary.overview
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
