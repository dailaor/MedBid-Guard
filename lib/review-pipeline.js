"use strict";

const { analyzeBidPackage } = require("./analyzer");
const { getLlmCapability, getLlmConfig, reviewWithLlm } = require("./llm-provider");

async function runReviewPipeline(payload = {}, options = {}) {
  const ruleResult = analyzeBidPackage(payload);
  const config = options.llmConfig || getLlmConfig();
  const capability = getLlmCapability(config);
  const pipeline = {
    mode: "rule_only",
    ruleEngine: {
      status: "applied",
      findingCount: ruleResult.findings.length
    },
    llm: {
      ...capability,
      status: capability.configured ? "configured" : "disabled"
    }
  };

  let aiReview = null;
  const reviewer = options.llmReviewer || reviewWithLlm;

  if (capability.configured) {
    try {
      aiReview = await reviewer({
        projectName: ruleResult.projectName,
        documents: Array.isArray(payload.documents) ? payload.documents : [],
        ruleResult,
        config
      });
      pipeline.mode = "rule_plus_llm";
      pipeline.llm.status = "applied";
    } catch (error) {
      pipeline.llm.status = "error";
      pipeline.llm.error = error instanceof Error ? error.message : "Unknown LLM error";
    }
  }

  return {
    ...ruleResult,
    pipeline,
    aiReview
  };
}

module.exports = {
  runReviewPipeline
};
