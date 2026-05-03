const test = require("node:test");
const assert = require("node:assert/strict");
const sample = require("../examples/demo-bid-package.json");
const { runReviewPipeline } = require("../lib/review-pipeline");

test("未配置推理服务时回退到规则引擎模式", async () => {
  const result = await runReviewPipeline(sample, {
    llmConfig: {
      enabled: false,
      provider: "openai-compatible",
      providerLabel: "OpenAI 兼容推理服务",
      baseUrl: "https://api.openai.com/v1",
      model: "",
      timeoutMs: 15000,
      missing: ["LLM_API_KEY", "LLM_MODEL"],
      usagePhases: ["技术响应语义判断"]
    }
  });

  assert.equal(result.pipeline.mode, "rule_only");
  assert.equal(result.pipeline.llm.status, "disabled");
  assert.equal(result.aiReview, null);
});

test("已配置推理服务时可挂接模型增强结果", async () => {
  const result = await runReviewPipeline(sample, {
    llmConfig: {
      enabled: true,
      provider: "openai-compatible",
      providerLabel: "OpenAI 兼容推理服务",
      baseUrl: "https://example.com/v1",
      model: "gpt-4.1-mini",
      timeoutMs: 15000,
      missing: [],
      usagePhases: ["技术响应语义判断", "授权链路解释"]
    },
    llmReviewer: async () => ({
      status: "applied",
      provider: "openai-compatible",
      providerLabel: "OpenAI 兼容推理服务",
      model: "gpt-4.1-mini",
      summary: "模型识别到技术响应描述笼统，建议补充证明材料。",
      focusAreas: ["技术响应语义判断", "授权主体关系说明"],
      findings: [
        {
          id: "AI-001",
          source: "llm",
          title: "技术响应存在笼统描述",
          severity: "medium",
          type: "模型增强审查",
          location: "06-技术响应表.txt",
          evidence: "报告输出项未写明具体格式，仅出现空项或待确认表述。",
          recommendation: "补充具体响应值，并提供彩页或说明书页码。"
        }
      ],
      manualReviewItems: [
        {
          item: "授权链路真实性",
          reason: "被授权单位名称与营业执照主体存在差异。",
          suggestedMaterial: "补充盖章授权链条或说明函。"
        }
      ]
    })
  });

  assert.equal(result.pipeline.mode, "rule_plus_llm");
  assert.equal(result.pipeline.llm.status, "applied");
  assert.equal(result.aiReview.summary.includes("技术响应"), true);
  assert.equal(result.aiReview.findings.length, 1);
  assert.equal(result.aiReview.manualReviewItems.length, 1);
});
