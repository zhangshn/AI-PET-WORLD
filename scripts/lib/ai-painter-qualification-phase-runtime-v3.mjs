// Fixed worker identity; private accounting state is isolated per version.
import {createQualificationPhaseRuntime} from "./ai-painter-qualification-phase-runtime-core.mjs";
import {runDecode1EntryQualificationOwnedWorkerV4,validateParameter60NativeProof} from './ai-painter-decode1-entry-qualification-owned-worker-v4.mjs';

const runtime=createQualificationPhaseRuntime({runOwnedWorker:runDecode1EntryQualificationOwnedWorkerV4,validateNativeProof:validateParameter60NativeProof});
export const createAccounting=runtime.createAccounting;
export const runOwnedPhase=runtime.runOwnedPhase;
