import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {classifySourceRelation, validateSourceIsolationContract} from "../lib/ai-painter-mvp-source-isolation.mjs";

const contract=JSON.parse(fs.readFileSync("data/ai-painter/system-governance/ai-painter-mvp-source-isolation-classification-contract-v1.json","utf8"));
const safeEvidence={licensedSourceBound:true,preprocessingFrozenBeforeSplit:true,deterministicProgramBound:true,
  sampleRgbRead:false,sampleSupervisionTargetRead:false,sampleRepairOrEvaluationFeedbackRead:false,
  sampleSpecificGeometryContextRead:false,positiveAreaPrimaryWindowOverlap:false};

test("contract is fail closed",()=>assert.equal(validateSourceIsolationContract(contract),contract));
test("sample-specific generation context must link",()=>assert.deepEqual(
  classifySourceRelation(contract,{kind:"sample_specific_geometry_context"}),
  {status:"must_link",crossSplitAllowed:false}));
test("claimed frozen public covariate cannot grant cross-split qualification",()=>assert.deepEqual(
  classifySourceRelation(contract,{kind:"shared_public_dem_operand",evidence:safeEvidence}),
  {status:"indeterminate_due_to_missing_evidence",crossSplitAllowed:false,
    failedRequirement:"authenticated_source_and_program_receipts"}));
test("metadata alone cannot grant cross-split qualification",()=>assert.deepEqual(
  classifySourceRelation(contract,{kind:"same_public_provider"}),
  {status:"not_automatic_dependency",crossSplitAllowed:false}));
test("public label is not a blanket exemption",()=>assert.equal(
  classifySourceRelation(contract,{kind:"shared_public_landcover_donor",evidence:{...safeEvidence,sampleSupervisionTargetRead:true}}).status,
  "indeterminate_due_to_missing_evidence"));
test("unknown relation fails closed",()=>assert.deepEqual(
  classifySourceRelation(contract,{kind:"unregistered_relation"}),
  {status:"indeterminate_due_to_missing_evidence",crossSplitAllowed:false}));
