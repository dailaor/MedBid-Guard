const test = require("node:test");
const assert = require("node:assert/strict");
const sample = require("../examples/demo-bid-package.json");
const { analyzeBidPackage } = require("../lib/analyzer");

test("示例包能识别主要高风险问题", () => {
  const result = analyzeBidPackage(sample);
  const codes = result.findings.map((finding) => finding.code);

  assert.equal(result.summary.totalDocuments, 8);
  assert.ok(result.summary.highRiskCount >= 3);
  assert.ok(codes.includes("MISSING_SERVICE_COMMITMENT"));
  assert.ok(codes.includes("MODEL_MISMATCH"));
  assert.ok(codes.includes("DOCUMENT_EXPIRED"));
  assert.ok(codes.includes("TECHNICAL_NEGATIVE_DEVIATION"));
});

test("最小合格样例至少能完成结构化输出", () => {
  const result = analyzeBidPackage({
    projectName: "示例项目",
    documents: [
      {
        name: "营业执照.txt",
        content: "营业执照\n企业名称：杭州明诚医疗科技有限公司\n统一社会信用代码：91330100MA27TEST9X"
      },
      {
        name: "经营备案凭证.txt",
        content: "第二类医疗器械经营备案凭证\n企业名称：杭州明诚医疗科技有限公司\n备案编号：浙杭药监械经营备20250018号\n有效期至：2027年12月31日"
      },
      {
        name: "产品注册证.txt",
        content: "医疗器械注册证\n产品名称：超声骨密度检测仪\n型号规格：MBG-9000\n注册证编号：国械注准20243070001\n注册人：苏州某某医疗器械有限公司\n有效期至：2027年06月15日"
      },
      {
        name: "厂家授权书.txt",
        content: "厂家授权书\n授权单位：苏州某某医疗器械有限公司\n被授权单位：杭州明诚医疗科技有限公司\n授权产品：超声骨密度检测仪\n授权型号：MBG-9000\n授权期限至：2027年08月30日"
      },
      {
        name: "技术响应表.txt",
        content: "技术参数响应表\n产品名称：超声骨密度检测仪\n型号规格：MBG-9000\n1. 检测部位：满足\n2. 报告输出：满足\n3. 质控：满足"
      }
    ]
  });

  assert.equal(result.structuredCatalog.length, 5);
  assert.equal(result.keyFacts.models.includes("MBG-9000"), true);
});
