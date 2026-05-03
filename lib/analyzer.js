"use strict";

const CATEGORY_DEFINITIONS = [
  {
    key: "business-license",
    label: "营业执照",
    module: "资格材料",
    keywords: ["营业执照", "统一社会信用代码", "法定代表人"]
  },
  {
    key: "filing",
    label: "经营备案凭证",
    module: "资格材料",
    keywords: ["经营备案", "备案凭证", "第二类医疗器械经营备案"]
  },
  {
    key: "license",
    label: "经营许可证",
    module: "资格材料",
    keywords: ["经营许可证", "医疗器械经营许可证"]
  },
  {
    key: "registration",
    label: "产品注册证",
    module: "证照与产品信息",
    keywords: ["注册证", "注册证编号", "医疗器械注册证", "注册人"]
  },
  {
    key: "authorization",
    label: "厂家授权书",
    module: "证照与产品信息",
    keywords: ["授权书", "厂家授权", "经销授权", "授权单位", "被授权单位"]
  },
  {
    key: "service-commitment",
    label: "售后承诺",
    module: "资格材料",
    keywords: ["售后承诺", "售后服务承诺", "维修响应", "质保承诺"]
  },
  {
    key: "performance",
    label: "类似业绩",
    module: "资格材料",
    keywords: ["类似业绩", "中标通知书", "历史业绩", "合同金额"]
  },
  {
    key: "technical",
    label: "技术响应",
    module: "技术响应",
    keywords: ["技术参数", "技术响应", "参数偏离", "配置清单", "技术规格"]
  },
  {
    key: "commercial",
    label: "商务响应",
    module: "商务响应",
    keywords: ["商务响应", "商务条款", "报价一览表"]
  },
  {
    key: "promise",
    label: "承诺函",
    module: "格式与附件",
    keywords: ["承诺函", "诚信投标", "无违法记录承诺"]
  },
  {
    key: "stamp-page",
    label: "签章页",
    module: "格式与附件",
    keywords: ["签章页", "盖章页", "签字盖章", "公章"]
  },
  {
    key: "attachment",
    label: "附件/目录",
    module: "格式与附件",
    keywords: ["附件", "附表", "目录"]
  }
];

const SEVERITY_SCORE = {
  high: 3,
  medium: 2,
  low: 1
};

const REQUIRED_RULES = [
  {
    code: "MISSING_BUSINESS_LICENSE",
    category: "business-license",
    severity: "high",
    title: "缺少营业执照材料",
    type: "材料完整性",
    recommendation: "补充最新版营业执照扫描件，确保名称与统一社会信用代码清晰可识别。",
    requiredByDefault: true
  },
  {
    code: "MISSING_OPERATING_QUALIFICATION",
    categories: ["filing", "license"],
    severity: "high",
    title: "缺少经营资质材料",
    type: "材料完整性",
    recommendation: "补充经营备案凭证或医疗器械经营许可证，并确认经营范围覆盖本次投标产品。",
    requiredByDefault: true
  },
  {
    code: "MISSING_REGISTRATION_CERTIFICATE",
    category: "registration",
    severity: "high",
    title: "缺少产品注册证材料",
    type: "材料完整性",
    recommendation: "补充拟投产品对应的医疗器械注册证或备案凭证，核对型号、注册证编号与有效期。",
    requiredByDefault: true
  },
  {
    code: "MISSING_MANUFACTURER_AUTHORIZATION",
    category: "authorization",
    severity: "high",
    title: "缺少厂家授权书",
    type: "材料完整性",
    recommendation: "补充厂家或注册人出具的授权材料，明确授权主体、被授权单位、授权产品、型号和有效期。",
    requiredByDefault: true
  },
  {
    code: "MISSING_TECHNICAL_RESPONSE",
    category: "technical",
    severity: "high",
    title: "缺少技术响应材料",
    type: "技术响应",
    recommendation: "补充技术参数响应表，逐项响应招标文件要求，并提供必要的证明材料。",
    requiredByDefault: true
  },
  {
    code: "MISSING_SERVICE_COMMITMENT",
    category: "service-commitment",
    severity: "medium",
    title: "缺少售后承诺材料",
    type: "材料完整性",
    recommendation: "按招标文件要求补充售后服务承诺，明确响应时效、质保期限和服务范围。",
    requirementHints: ["售后承诺", "售后服务承诺", "维修响应", "质保承诺"]
  },
  {
    code: "MISSING_PERFORMANCE_DOCS",
    category: "performance",
    severity: "medium",
    title: "缺少类似业绩材料",
    type: "材料完整性",
    recommendation: "补充与本项目相近的设备供货或服务业绩，并附合同或中标通知书等证明。",
    requirementHints: ["类似业绩", "历史业绩", "中标通知书", "合同金额"]
  },
  {
    code: "MISSING_PROMISE_LETTER",
    category: "promise",
    severity: "medium",
    title: "缺少承诺函",
    type: "格式完整性",
    recommendation: "补充招标文件要求的承诺函，确保落款、日期和签章完整。",
    requirementHints: ["承诺函", "诚信投标", "无违法记录承诺"]
  }
];

function analyzeBidPackage(payload = {}) {
  const projectName = normalizeWhitespace(payload.projectName || "未命名项目");
  const documents = Array.isArray(payload.documents)
    ? payload.documents.map((document, index) => normalizeDocument(document, index))
    : [];

  const requirementText = documents.map((document) => `${document.name}\n${document.content}`).join("\n");
  const findings = [];

  addRequiredMaterialFindings(documents, requirementText, findings);
  addReadabilityFindings(documents, findings);
  addConsistencyFindings(documents, findings);
  addExpiryFindings(documents, findings);
  addTechnicalFindings(documents, findings);
  addFormatFindings(documents, findings);

  const sortedFindings = findings
    .map((finding, index) => ({
      id: `F-${String(index + 1).padStart(3, "0")}`,
      ...finding
    }))
    .sort((left, right) => {
      const severityGap = SEVERITY_SCORE[right.severity] - SEVERITY_SCORE[left.severity];
      if (severityGap !== 0) {
        return severityGap;
      }
      return left.title.localeCompare(right.title, "zh-CN");
    });

  return {
    projectName,
    generatedAt: new Date().toISOString(),
    summary: buildSummary(documents, sortedFindings),
    keyFacts: buildGlobalFacts(documents),
    structuredCatalog: documents.map(toCatalogEntry),
    findings: sortedFindings,
    nextActions: buildNextActions(sortedFindings),
    limitations: [
      "当前 MVP 优先支持文本型材料；PDF 扫描件、图片和加密文档会被标记为需 OCR 或人工复核。",
      "规则引擎用于资格预审和风险提示，不替代人工法务、注册或售前审核结论。",
      "多产品、多包件场景可能出现多型号/多注册证的合理情况，需结合招标范围人工确认。"
    ]
  };
}

function normalizeDocument(document, index) {
  const name = normalizeWhitespace(document?.name || `未命名材料-${index + 1}`);
  const content = typeof document?.content === "string" ? document.content.replace(/\r\n/g, "\n").trim() : "";
  const fileType = normalizeWhitespace(document?.type || "unknown");
  const size = Number.isFinite(document?.size) ? Number(document.size) : Buffer.byteLength(content, "utf8");
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "";
  const matchedDefinitions = CATEGORY_DEFINITIONS
    .map((definition) => ({
      definition,
      score: countMatches(`${name}\n${content}`, definition.keywords)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.definition);

  const primaryCategory = matchedDefinitions[0] || {
    key: "other",
    label: "其他附件",
    module: "其他材料"
  };

  const facts = extractFacts(content);
  const readStatus = !content
    ? "needs_review"
    : content.length < 30
      ? "partial"
      : "ok";

  return {
    id: `DOC-${String(index + 1).padStart(2, "0")}`,
    name,
    content,
    fileType,
    size,
    extension,
    matchedDefinitions,
    primaryCategory,
    facts,
    readStatus,
    textLength: content.length,
    technicalRows: extractTechnicalRows(content),
    attachmentRefs: extractAttachmentRefs(content)
  };
}

function addRequiredMaterialFindings(documents, requirementText, findings) {
  const evidenceDocuments = documents.filter((document) => !isRequirementLikeDocument(document));

  for (const rule of REQUIRED_RULES) {
    const shouldCheck = rule.requiredByDefault || hasRequirementHint(requirementText, rule.requirementHints || []);
    if (!shouldCheck) {
      continue;
    }

    const hit = rule.category
      ? evidenceDocuments.some((document) => hasCategory(document, rule.category))
      : evidenceDocuments.some((document) => (rule.categories || []).some((category) => hasCategory(document, category)));

    if (!hit) {
      findings.push({
        code: rule.code,
        severity: rule.severity,
        type: rule.type,
        title: rule.title,
        location: "全卷检查",
        evidence: "当前上传材料中未识别到对应模块。",
        recommendation: rule.recommendation
      });
    }
  }
}

function addReadabilityFindings(documents, findings) {
  for (const document of documents) {
    if (document.readStatus === "needs_review") {
      findings.push({
        code: "UNREADABLE_DOCUMENT",
        severity: isCriticalCategory(document.primaryCategory.key) ? "high" : "medium",
        type: "材料可读性",
        title: `材料无法直接识别：${document.name}`,
        location: document.name,
        evidence: "文件内容为空，或当前 MVP 无法直接提取文本。",
        recommendation: "补充可复制文本、OCR 结果或更清晰的扫描件，再重新审查。"
      });
      continue;
    }

    if (document.readStatus === "partial" && isCriticalCategory(document.primaryCategory.key)) {
      findings.push({
        code: "PARTIAL_DOCUMENT_CONTENT",
        severity: "medium",
        type: "材料完整性",
        title: `关键材料内容过少：${document.name}`,
        location: document.name,
        evidence: `可识别文本长度仅 ${document.textLength} 字，可能存在缺页或提取不完整。`,
        recommendation: "检查扫描质量、页数完整性和 OCR 结果，确保关键字段清晰可核验。"
      });
    }
  }
}

function addConsistencyFindings(documents, findings) {
  const bidderNames = uniqueValues(documents.flatMap((document) => [
    ...document.facts.companyNames,
    ...document.facts.authorizedParties
  ]));
  const productNames = uniqueValues(documents.flatMap((document) => document.facts.productNames));
  const models = uniqueValues(documents.flatMap((document) => document.facts.models));
  const registrationNumbers = uniqueValues(documents.flatMap((document) => document.facts.registrationNumbers));
  const registrants = uniqueValues(documents.flatMap((document) => [
    ...document.facts.registrants,
    ...document.facts.authorizers
  ]));

  if (bidderNames.length > 1) {
    findings.push({
      code: "BIDDER_NAME_MISMATCH",
      severity: "high",
      type: "证照一致性",
      title: "投标主体名称前后不一致",
      location: "全卷检查",
      evidence: `检测到多个投标主体名称：${bidderNames.join(" / ")}`,
      recommendation: "统一营业执照、备案/许可证、授权书中的被授权单位名称，避免因名称差异导致资格不通过。"
    });
  }

  if (productNames.length > 1) {
    findings.push({
      code: "PRODUCT_NAME_MISMATCH",
      severity: "medium",
      type: "证照一致性",
      title: "产品名称存在多个版本",
      location: "全卷检查",
      evidence: `检测到多个产品名称：${productNames.join(" / ")}`,
      recommendation: "核对招标要求、注册证、授权书和技术响应中的产品名称是否一致。"
    });
  }

  if (models.length > 1) {
    findings.push({
      code: "MODEL_MISMATCH",
      severity: "high",
      type: "证照一致性",
      title: "产品型号规格前后不一致",
      location: "全卷检查",
      evidence: `检测到多个型号：${models.join(" / ")}`,
      recommendation: "统一招标响应、注册证和授权书中的型号规格，必要时补充覆盖全部型号的授权与注册证明。"
    });
  }

  if (registrationNumbers.length > 1) {
    findings.push({
      code: "MULTIPLE_REGISTRATION_NUMBERS",
      severity: "medium",
      type: "证照一致性",
      title: "检测到多个注册证编号",
      location: "全卷检查",
      evidence: `识别到多个编号：${registrationNumbers.join(" / ")}`,
      recommendation: "确认是否为多产品联合投标；若仅投单一产品，请保留唯一有效的注册证编号。"
    });
  }

  if (registrants.length > 1) {
    findings.push({
      code: "AUTHORIZATION_SUBJECT_MISMATCH",
      severity: "medium",
      type: "证照一致性",
      title: "注册人/授权主体存在差异",
      location: "全卷检查",
      evidence: `检测到多个主体：${registrants.join(" / ")}`,
      recommendation: "确认授权出具方与产品注册人或其合法授权链条一致，并在材料中说明关系。"
    });
  }

  const authorizationDocs = documents.filter((document) => hasCategory(document, "authorization"));
  if (authorizationDocs.length > 0) {
    const referenceModels = uniqueValues(
      documents
        .filter((document) => !hasCategory(document, "authorization"))
        .flatMap((document) => document.facts.models)
    );

    for (const document of authorizationDocs) {
      const authorizedModels = uniqueValues(document.facts.models);
      if (referenceModels.length > 0 && authorizedModels.length > 0 && !hasIntersection(referenceModels, authorizedModels)) {
        findings.push({
          code: "AUTHORIZATION_MODEL_NOT_COVERED",
          severity: "high",
          type: "授权覆盖",
          title: "授权型号未覆盖拟投产品",
          location: document.name,
          evidence: `授权书型号：${authorizedModels.join(" / ")}；其他材料型号：${referenceModels.join(" / ")}`,
          recommendation: "补充覆盖拟投型号的授权书，或统一各材料中的产品型号。"
        });
      }
    }
  }
}

function addExpiryFindings(documents, findings) {
  const today = new Date();

  for (const document of documents) {
    for (const expiry of document.facts.expiryDates) {
      const parsed = parseDateValue(expiry);
      if (!parsed) {
        continue;
      }

      const dayGap = Math.ceil((parsed.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      if (dayGap < 0) {
        findings.push({
          code: "DOCUMENT_EXPIRED",
          severity: "high",
          type: "证照有效期",
          title: `材料已过期：${document.name}`,
          location: document.name,
          evidence: `识别到有效期 ${formatDate(parsed)}，已过期 ${Math.abs(dayGap)} 天。`,
          recommendation: "更换为在有效期内的证照或授权文件，并重新核验投标资格。"
        });
      } else if (dayGap <= 90) {
        findings.push({
          code: "DOCUMENT_NEAR_EXPIRY",
          severity: "medium",
          type: "证照有效期",
          title: `材料临近到期：${document.name}`,
          location: document.name,
          evidence: `识别到有效期 ${formatDate(parsed)}，距离到期约 ${dayGap} 天。`,
          recommendation: "确认开标及履约期间证照仍然有效，必要时提前更换新版文件。"
        });
      }
    }
  }
}

function addTechnicalFindings(documents, findings) {
  const technicalDocs = documents.filter((document) => hasCategory(document, "technical"));
  for (const document of technicalDocs) {
    if (document.technicalRows.length === 0) {
      findings.push({
        code: "TECHNICAL_RESPONSE_TOO_GENERIC",
        severity: "medium",
        type: "技术响应",
        title: `技术响应内容过于笼统：${document.name}`,
        location: document.name,
        evidence: "未识别到可逐项核验的技术响应条目。",
        recommendation: "按技术参数逐项列出响应内容，并附彩页、说明书或检测报告等证明。"
      });
      continue;
    }

    for (const row of document.technicalRows) {
      if (/(不满足|不支持|偏离|无此功能|未达到)/.test(row)) {
        findings.push({
          code: "TECHNICAL_NEGATIVE_DEVIATION",
          severity: "high",
          type: "技术响应",
          title: "检测到疑似负偏离项",
          location: document.name,
          evidence: row,
          recommendation: "复核该参数是否为实质性条款；如无法满足，应评估是否需要更换产品或调整投标策略。"
        });
      } else if (/(待确认|待补充|详见附件|详见彩页|后附)/.test(row)) {
        findings.push({
          code: "TECHNICAL_PENDING_SUPPORT",
          severity: "medium",
          type: "技术响应",
          title: "技术响应证明不足或待补充",
          location: document.name,
          evidence: row,
          recommendation: "补充明确响应值和对应证明材料，避免仅写“详见附件”但无实际支撑。"
        });
      } else if (/[:：]\s*$/.test(row)) {
        findings.push({
          code: "TECHNICAL_EMPTY_RESPONSE",
          severity: "medium",
          type: "技术响应",
          title: "技术参数存在空项",
          location: document.name,
          evidence: row,
          recommendation: "补全该参数的具体响应内容，避免空项被认定为未响应。"
        });
      }
    }
  }
}

function addFormatFindings(documents, findings) {
  const allAttachmentRefs = uniqueNumbers(documents.flatMap((document) => document.attachmentRefs));
  if (allAttachmentRefs.length > 1) {
    const missingRefs = [];
    for (let index = allAttachmentRefs[0]; index <= allAttachmentRefs[allAttachmentRefs.length - 1]; index += 1) {
      if (!allAttachmentRefs.includes(index)) {
        missingRefs.push(index);
      }
    }

    if (missingRefs.length > 0) {
      findings.push({
        code: "ATTACHMENT_SEQUENCE_GAP",
        severity: "medium",
        type: "格式完整性",
        title: "附件编号不连续",
        location: "全卷检查",
        evidence: `识别到附件编号 ${allAttachmentRefs.join(", ")}，缺失编号 ${missingRefs.join(", ")}。`,
        recommendation: "检查目录、正文引用和附件命名是否一致，避免开评标时出现附件缺失或错号。"
      });
    }
  }

  const promiseDocs = documents.filter((document) => hasCategory(document, "promise"));
  for (const document of promiseDocs) {
    const hasDate = /([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)|([0-9]{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2})/.test(document.content);
    const hasSignature = /(盖章|签章|公章|签字|法定代表人|单位名称)/.test(document.content);
    if (!hasDate || !hasSignature) {
      findings.push({
        code: "PROMISE_LETTER_FORMAT_INCOMPLETE",
        severity: "medium",
        type: "格式完整性",
        title: `承诺函格式不完整：${document.name}`,
        location: document.name,
        evidence: `日期${hasDate ? "已识别" : "缺失"}，落款/签章${hasSignature ? "已识别" : "缺失"}。`,
        recommendation: "补充完整落款单位、日期和签章位置，避免形式性废标。"
      });
    }
  }

  const referencedAttachmentNumbers = new Set();
  const attachmentNamedNumbers = new Set();
  for (const document of documents) {
    document.attachmentRefs.forEach((number) => referencedAttachmentNumbers.add(number));
    const matches = document.name.match(/附件\s*([0-9]+)/g) || [];
    for (const match of matches) {
      const number = Number(match.replace(/[^\d]/g, ""));
      if (Number.isFinite(number)) {
        attachmentNamedNumbers.add(number);
      }
    }
  }

  const missingNamedAttachments = [...referencedAttachmentNumbers].filter((number) => !attachmentNamedNumbers.has(number));
  if (missingNamedAttachments.length > 0) {
    findings.push({
      code: "REFERENCED_ATTACHMENT_NOT_FOUND",
      severity: "medium",
      type: "格式完整性",
      title: "正文引用的附件未在材料清单中识别到",
      location: "全卷检查",
      evidence: `引用附件编号：${missingNamedAttachments.join(", ")}。`,
      recommendation: "确认正文中引用的附件已实际提供，并在文件名或目录中保持同一编号。"
    });
  }
}

function buildSummary(documents, findings) {
  const totalDocuments = documents.length;
  const highRiskCount = findings.filter((finding) => finding.severity === "high").length;
  const mediumRiskCount = findings.filter((finding) => finding.severity === "medium").length;
  const lowRiskCount = findings.filter((finding) => finding.severity === "low").length;
  const manualReviewCount = documents.filter((document) => document.readStatus === "needs_review").length;

  return {
    totalDocuments,
    readableDocuments: documents.filter((document) => document.readStatus === "ok").length,
    partialDocuments: documents.filter((document) => document.readStatus === "partial").length,
    manualReviewCount,
    totalFindings: findings.length,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    overallLevel: highRiskCount > 0 ? "高风险" : mediumRiskCount > 0 ? "中风险" : "低风险",
    overview:
      highRiskCount > 0
        ? "存在可能导致资格不通过或废标的高风险项，建议优先补齐核心证照、授权和技术响应。"
        : mediumRiskCount > 0
          ? "存在一定形式性或一致性风险，建议开标前完成补充和人工复核。"
          : "未发现明显高风险缺陷，但仍建议结合原始招标文件做人工终审。"
  };
}

function buildGlobalFacts(documents) {
  return {
    companyNames: uniqueValues(documents.flatMap((document) => [
      ...document.facts.companyNames,
      ...document.facts.authorizedParties
    ])),
    productNames: uniqueValues(documents.flatMap((document) => document.facts.productNames)),
    models: uniqueValues(documents.flatMap((document) => document.facts.models)),
    registrationNumbers: uniqueValues(documents.flatMap((document) => document.facts.registrationNumbers)),
    registrants: uniqueValues(documents.flatMap((document) => [
      ...document.facts.registrants,
      ...document.facts.authorizers
    ]))
  };
}

function buildNextActions(findings) {
  const highest = findings.filter((finding) => finding.severity === "high").slice(0, 3);
  if (highest.length > 0) {
    return highest.map((finding) => ({
      priority: "立即处理",
      focus: finding.title,
      action: finding.recommendation
    }));
  }

  return findings.slice(0, 3).map((finding) => ({
    priority: "建议处理",
    focus: finding.title,
    action: finding.recommendation
  }));
}

function toCatalogEntry(document) {
  return {
    id: document.id,
    name: document.name,
    module: document.primaryCategory.module,
    category: document.primaryCategory.label,
    readStatus: document.readStatus,
    textLength: document.textLength,
    tags: document.matchedDefinitions.map((definition) => definition.label),
    extractedFacts: {
      companyNames: document.facts.companyNames,
      productNames: document.facts.productNames,
      models: document.facts.models,
      registrationNumbers: document.facts.registrationNumbers,
      expiryDates: document.facts.expiryDates
    }
  };
}

function extractFacts(text) {
  return {
    companyNames: extractMatchedGroups(text, [
      /(?:企业名称|公司名称|投标人名称)[:：]\s*([^\n]+)/g
    ]),
    productNames: extractMatchedGroups(text, [
      /(?:产品名称|投标产品名称|授权产品)[:：]\s*([^\n]+)/g
    ]),
    models: extractMatchedGroups(text, [
      /(?:型号规格|型号|授权型号)[:：]\s*([^\n]+)/g
    ]).map(normalizeModelValue),
    registrationNumbers: extractMatchedGroups(text, [
      /(?:注册证编号|注册证号|备案编号|证书编号)[:：]\s*([A-Za-z0-9\u4e00-\u9fa5-]+)/g
    ]),
    registrants: extractMatchedGroups(text, [
      /(?:注册人|生产企业|制造商)[:：]\s*([^\n]+)/g
    ]),
    authorizers: extractMatchedGroups(text, [
      /(?:授权单位|授权主体|厂家)[:：]\s*([^\n]+)/g
    ]),
    authorizedParties: extractMatchedGroups(text, [
      /(?:被授权单位|授权经销商|受托方)[:：]\s*([^\n]+)/g
    ]),
    expiryDates: extractMatchedGroups(text, [
      /(?:有效期至|授权期限至|有效期限|证照有效期)[:：\s]*([0-9]{4}[年./-][0-9]{1,2}[月./-][0-9]{1,2}日?)/g
    ])
  };
}

function extractTechnicalRows(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /[:：]/.test(line))
    .filter((line) => /(参数|功能|配置|响应|支持|检测|报告|质控|输出|接口|校准|性能)|(^\d+[.)、])/.test(line));
}

function extractAttachmentRefs(text) {
  const refs = [];
  const matcher = /附件\s*([0-9]+)/g;
  let match = matcher.exec(text);
  while (match) {
    refs.push(Number(match[1]));
    match = matcher.exec(text);
  }
  return refs.filter((value) => Number.isFinite(value));
}

function extractMatchedGroups(text, expressions) {
  const results = [];
  for (const expression of expressions) {
    let match = expression.exec(text);
    while (match) {
      const value = normalizeWhitespace(match[1] || "");
      if (value) {
        results.push(value);
      }
      match = expression.exec(text);
    }
  }
  return uniqueValues(results);
}

function hasRequirementHint(text, hints) {
  return hints.some((hint) => text.includes(hint));
}

function countMatches(text, keywords) {
  return keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);
}

function hasCategory(document, categoryKey) {
  return document.matchedDefinitions.some((definition) => definition.key === categoryKey);
}

function isCriticalCategory(categoryKey) {
  return ["business-license", "filing", "license", "registration", "authorization", "technical"].includes(categoryKey);
}

function isRequirementLikeDocument(document) {
  return /(招标要求|需提供|投标人须知|资格审查|采购需求|评分办法|废标条款)/.test(document.content);
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeModelValue(value) {
  return normalizeWhitespace(value).replace(/[（(].*?[）)]/g, "").toUpperCase();
}

function parseDateValue(rawValue) {
  const normalized = rawValue
    .replace(/年/g, "-")
    .replace(/月/g, "-")
    .replace(/日/g, "")
    .replace(/\./g, "-")
    .replace(/\//g, "-");

  const [year, month, day] = normalized.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueNumbers(values) {
  return [...new Set(values.filter((value) => Number.isFinite(value)))].sort((left, right) => left - right);
}

function hasIntersection(left, right) {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

module.exports = {
  analyzeBidPackage
};
