from copy import deepcopy
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from ai_painter.complete_world import regrouped_candidate as candidate
from ai_painter.complete_world import split_release as release
from test_stage4_split_release import fixture_rows


class RegroupedCandidateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="regroup64-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.rows = fixture_rows()
        self.parent = {"path": "parent.json", "sha256": "a" * 64}
        self.observed = {"schemaVersion": "controller-current64-naturalization-donor-trace-v1",
                         "datasetManifest": self.parent,
                         "rows": [{"sampleId": r["sampleId"], "split": r["split"], "donorEdges": []} for r in self.rows]}
        self.observed_binding = self.write("observed.json", self.observed)
        witness = [{"sampleId": r["sampleId"], "split": r["split"], "proposedSplit": r["split"]} for r in self.rows]
        witness[0]["proposedSplit"], witness[48]["proposedSplit"] = "validation", "train"
        self.proposal = {"schemaVersion": "controller-observed-group-capacity-relaxation-v1",
                         "datasetManifest": self.parent, "source": self.observed_binding,
                         "fullContractFeasible": None, "trainingAllowed": False,
                         "constraintsNotSolved": ["history", "coverage"],
                         "relaxedProblem": {"capacities": release.COUNTS, "minimumMembershipChanges": 2, "witness": witness}}
        self.binding = self.write("proposal.json", self.proposal)
        self.loader = patch.object(candidate, "load_package", side_effect=lambda *args: ({}, deepcopy(self.rows)))
        self.loader.start()
        self.addCleanup(self.loader.stop)

    def write(self, name, value):
        data = release.canonical_bytes(value) + b"\n"
        (self.root / name).write_bytes(data)
        return {"path": name, "sha256": release.digest(data)}

    def test_preserves_assets_history_and_denies_training(self):
        binding = candidate.materialize_candidate(self.root, self.parent, self.binding)
        self.assertEqual(binding, candidate.materialize_candidate(self.root, self.parent, self.binding))
        manifest = release.bound_json(self.root, binding)
        rows = release.bound_json(self.root, manifest["sourceIndex"])["samples"]
        self.assertEqual(rows[0]["sourceSplit"], "train")
        self.assertEqual(rows[0]["split"], "validation")
        self.assertFalse(any(manifest["qualification"].values()))
        for old, new in zip(self.rows, rows):
            for key in old:
                if key != "split":
                    self.assertEqual(old[key], new[key])
        # The review package is loadable only after its immutable parent and
        # proposal have been authenticated; this fixture intentionally has no
        # parent file, so it cannot be mistaken for a training release.
        with self.assertRaises((FileNotFoundError, ValueError)):
            release.load_package(self.root, binding)

    def test_duplicate_or_count_manipulation_rejected(self):
        for change in ("duplicate", "count"):
            proposal = deepcopy(self.proposal)
            if change == "duplicate":
                proposal["relaxedProblem"]["witness"][1] = proposal["relaxedProblem"]["witness"][0]
            else:
                proposal["relaxedProblem"]["witness"][2]["proposedSplit"] = "challenge"
            binding = self.write(change + ".json", proposal)
            with self.assertRaises(ValueError):
                candidate.build_candidate(self.root, self.parent, binding)

    def test_no_historical_split_laundering_or_qualification_grant(self):
        for change in ("history", "grant", "parent"):
            proposal = deepcopy(self.proposal)
            if change == "history":
                proposal["relaxedProblem"]["witness"][0]["split"] = "validation"
            elif change == "grant":
                proposal["trainingAllowed"] = True
            else:
                proposal["datasetManifest"] = {"path": "other.json", "sha256": "b" * 64}
            with self.assertRaises(ValueError):
                candidate.build_candidate(self.root, self.parent, self.write(change + ".json", proposal))

    def test_known_dependency_split_rejected(self):
        self.observed["rows"][0]["donorEdges"] = [{"sampleId": self.rows[1]["sampleId"]}]
        self.proposal["source"] = self.write("observed.json", self.observed)
        with self.assertRaisesRegex(ValueError, "donor group"):
            candidate.build_candidate(self.root, self.parent, self.write("proposal.json", self.proposal))

    def test_tampering_not_overwritten(self):
        binding = candidate.materialize_candidate(self.root, self.parent, self.binding)
        manifest = release.bound_json(self.root, binding)
        target = self.root / manifest["splits"]["train"]["path"]
        target.write_bytes(b"tampered")
        with self.assertRaisesRegex(ValueError, "immutable candidate conflict"):
            candidate.materialize_candidate(self.root, self.parent, self.binding)
        self.assertEqual(target.read_bytes(), b"tampered")

    def test_existing_lock_not_removed(self):
        manifest, _ = candidate.build_candidate(self.root, self.parent, self.binding)
        directory = self.root / release.PACKAGE_ROOT / manifest["packageId"]
        directory.mkdir(parents=True)
        lock = directory / ".materialization.lock"
        lock.write_text("unknown writer")
        with self.assertRaises(FileExistsError):
            candidate.materialize_candidate(self.root, self.parent, self.binding)
        self.assertTrue(lock.exists())

    def test_mvp_split_correction_preserves_challenge_and_moves_exposure_to_train(self):
        history = {"schemaVersion": "ai-painter-stage4-historical-exposure-audit-v1",
                   "perSample": [{"sampleId": r["sampleId"], "recordedOptimizerRuns": 0,
                                  "recordedOptimizerSteps": 0} for r in self.rows]}
        history["perSample"][48]["recordedOptimizerRuns"] = 1
        history_binding = self.write("history.json", history)
        contract_binding = self.write("contract.json", {
            "schemaVersion": "ai-painter-mvp-source-isolation-classification-contract-v1",
            "policyVersion": "AI-PAINTER-DATA-PROVENANCE-1.7"})
        witness = [{"sampleId": r["sampleId"], "split": r["split"], "proposedSplit": r["split"]}
                   for r in self.rows]
        witness[0]["proposedSplit"], witness[48]["proposedSplit"] = "validation", "train"
        challenge = [r["sampleId"] for r in self.rows if r["split"] == "challenge"]
        proposal = {"schemaVersion": "controller-stage4-mvp-split-correction-v1",
                    "status": "feasible_under_current_contract_for_split_membership_only",
                    "parentManifest": self.parent, "trainingAllowed": False,
                    "sourceIsolationContract": contract_binding,
                    "evidence": {"historicalExposure": history_binding},
                    "splitPlan": {"capacities": release.COUNTS, "minimumMembershipChanges": 2,
                                  "witness": witness},
                    "challengeIdentityPreserved": True, "challengeSampleIds": challenge,
                    "historicalUseResolution": {"freshDenoiserAndNoParentRequired": True,
                                                "oldDenoiserWeightInheritanceAllowed": False},
                    "sourceRuleResolution": {"blanketPublicSourceExemption": False,
                                             "blanketNumericMustLink": False},
                    "remainingGates": ["foundation"]}
        manifest, artifacts = candidate.build_candidate(self.root, self.parent,
                                                         self.write("mvp-proposal.json", proposal))
        source = __import__("json").loads(artifacts["source-index.json"])
        self.assertEqual([r["sampleId"] for r in source["samples"] if r["split"] == "challenge"], challenge)
        self.assertFalse(manifest["qualification"]["trainingAllowed"])


if __name__ == "__main__":
    unittest.main()
