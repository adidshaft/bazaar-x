import type { Hex } from "viem";
import { readArtifact } from "../server/artifacts";
import {
  DEPLOYMENT_ARTIFACT_PATH,
  X402_LEDGER_ARTIFACT_PATH,
} from "../server/config";
import { explorerTxUrl } from "../xlayer";
import type {
  DeploymentArtifact,
  LiveRuntimeArtifact,
  StepRecord,
} from "./types";

type X402LedgerSession = {
  createdAt?: string;
  updatedAt?: string;
  fulfilledResponse?: unknown;
};

type X402LedgerArtifact = {
  sessions?: Record<string, X402LedgerSession>;
};

type RuntimeRecoverySnapshot = {
  runtime: LiveRuntimeArtifact | null;
  recovered: boolean;
  canonical: LiveRuntimeArtifact | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asRuntimeArtifact(value: unknown): LiveRuntimeArtifact | null {
  if (!isObject(value) || !Array.isArray(value.steps) || !Array.isArray(value.txHashes)) {
    return null;
  }

  return value as unknown as LiveRuntimeArtifact;
}

function normalizeHash(hash: string | undefined) {
  return hash?.toLowerCase() ?? "";
}

function stepFingerprint(step: StepRecord) {
  if (step.txHash) {
    return `tx:${normalizeHash(step.txHash)}`;
  }

  return [
    step.key,
    step.status,
    step.completedAt ?? step.startedAt,
    step.label,
    step.detail ?? "",
  ].join("|");
}

function mergeTxHashes(...sources: Array<readonly Hex[] | undefined>) {
  const seen = new Set<string>();
  const merged: Hex[] = [];

  sources.forEach((source) => {
    source?.forEach((hash) => {
      const fingerprint = normalizeHash(hash);
      if (!fingerprint || seen.has(fingerprint)) {
        return;
      }

      seen.add(fingerprint);
      merged.push(hash);
    });
  });

  return merged;
}

function mergeSteps(...sources: Array<readonly StepRecord[] | undefined>) {
  const seen = new Set<string>();
  const merged: StepRecord[] = [];

  sources.forEach((source) => {
    source?.forEach((step) => {
      const fingerprint = stepFingerprint(step);
      if (seen.has(fingerprint)) {
        return;
      }

      seen.add(fingerprint);
      merged.push(step);
    });
  });

  return merged;
}

function parseTimestamp(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function latestTimestamp(...values: Array<string | undefined>) {
  return values.reduce((latest, value) => {
    const timestamp = parseTimestamp(value);
    return timestamp > latest ? timestamp : latest;
  }, 0);
}

function resolveRuntimeContractAddress(
  runtime: LiveRuntimeArtifact | null,
  fulfilledResponse: unknown,
) {
  if (runtime?.deployment?.contractAddress) {
    return runtime.deployment.contractAddress.toLowerCase();
  }

  if (!isObject(fulfilledResponse)) {
    return null;
  }

  const status = fulfilledResponse.status;
  if (!isObject(status)) {
    return null;
  }

  const onchainSnapshot = status.onchainSnapshot;
  if (isObject(onchainSnapshot) && typeof onchainSnapshot.address === "string") {
    return onchainSnapshot.address.toLowerCase();
  }

  const bazaarSnapshot = status.bazaarSnapshot;
  if (isObject(bazaarSnapshot) && typeof bazaarSnapshot.address === "string") {
    return bazaarSnapshot.address.toLowerCase();
  }

  return null;
}

function buildDeployStep(deployment: DeploymentArtifact): StepRecord {
  return {
    key: "deploy",
    label: "Deploy Bazaar X contract",
    status: "success",
    startedAt: deployment.deployedAt,
    completedAt: deployment.deployedAt,
    txHash: deployment.deployTxHash,
    explorerUrl: explorerTxUrl(deployment.deployTxHash, deployment.explorerBaseUrl),
    detail: `Deployed Bazaar X to ${deployment.contractAddress}.`,
    meta: {
      simulated: false,
    },
  };
}

function ensureDeployRuntime(
  runtime: LiveRuntimeArtifact | null,
  deployment: DeploymentArtifact | null,
): LiveRuntimeArtifact | null {
  if (!runtime) {
    return null;
  }

  const resolvedDeployment = runtime.deployment ?? deployment ?? undefined;
  const hasDeployStep = runtime.steps.some(
    (step) => step.key === "deploy" && step.status === "success",
  );

  const steps = hasDeployStep
    ? runtime.steps
    : resolvedDeployment
      ? mergeSteps([buildDeployStep(resolvedDeployment)], runtime.steps)
      : runtime.steps;

  const txHashes =
    resolvedDeployment && !runtime.txHashes.some((hash) => normalizeHash(hash) === normalizeHash(resolvedDeployment.deployTxHash))
      ? mergeTxHashes([resolvedDeployment.deployTxHash], runtime.txHashes)
      : runtime.txHashes;

  return {
    ...runtime,
    deployment: resolvedDeployment,
    steps,
    txHashes,
  };
}

function runtimeContainsAllCanonicalSteps(
  current: LiveRuntimeArtifact | null,
  canonical: LiveRuntimeArtifact | null,
) {
  if (!current || !canonical) {
    return false;
  }

  const currentFingerprints = new Set(current.steps.map(stepFingerprint));
  return canonical.steps.every((step) => currentFingerprints.has(stepFingerprint(step)));
}

async function selectCanonicalRuntime(
  deployment: DeploymentArtifact | null,
) {
  const ledger = await readArtifact<X402LedgerArtifact>(X402_LEDGER_ARTIFACT_PATH);
  const deploymentAddress = deployment?.contractAddress.toLowerCase() ?? null;

  let best:
    | {
        runtime: LiveRuntimeArtifact;
        score: [number, number, number, number];
      }
    | null = null;

  for (const session of Object.values(ledger?.sessions ?? {})) {
    const fulfilledResponse = isObject(session.fulfilledResponse) ? session.fulfilledResponse : null;
    const status = fulfilledResponse && isObject(fulfilledResponse.status) ? fulfilledResponse.status : null;
    const runtime = asRuntimeArtifact(status?.runtime);
    if (!runtime) {
      continue;
    }

    const runtimeAddress = resolveRuntimeContractAddress(runtime, fulfilledResponse);
    const addressMatch =
      deploymentAddress && runtimeAddress
        ? Number(runtimeAddress === deploymentAddress)
        : 0;
    const score: [number, number, number, number] = [
      addressMatch,
      runtime.steps.length,
      runtime.txHashes.length,
      latestTimestamp(runtime.lastUpdatedAt, session.updatedAt, session.createdAt),
    ];

    if (
      !best ||
      score[0] > best.score[0] ||
      (score[0] === best.score[0] && score[1] > best.score[1]) ||
      (score[0] === best.score[0] && score[1] === best.score[1] && score[2] > best.score[2]) ||
      (score[0] === best.score[0] &&
        score[1] === best.score[1] &&
        score[2] === best.score[2] &&
        score[3] > best.score[3])
    ) {
      best = {
        runtime,
        score,
      };
    }
  }

  if (!best) {
    return ensureDeployRuntime(null, deployment);
  }

  return ensureDeployRuntime(best.runtime, deployment);
}

function mergeRuntimeArtifacts(
  current: LiveRuntimeArtifact | null,
  canonical: LiveRuntimeArtifact | null,
  deployment: DeploymentArtifact | null,
) {
  if (!current && !canonical) {
    return null;
  }

  const resolvedCanonical = ensureDeployRuntime(canonical, deployment);
  const resolvedCurrent = ensureDeployRuntime(current, deployment);
  const base = resolvedCanonical ?? resolvedCurrent;
  if (!base) {
    return null;
  }

  const currentHasMoreSteps =
    (resolvedCurrent?.steps.length ?? 0) > (resolvedCanonical?.steps.length ?? 0);
  const lastUpdatedAt = new Date(
    Math.max(
      latestTimestamp(resolvedCanonical?.lastUpdatedAt),
      latestTimestamp(resolvedCurrent?.lastUpdatedAt),
      latestTimestamp(deployment?.deployedAt),
    ) || Date.now(),
  ).toISOString();

  return {
    ...base,
    ...resolvedCanonical,
    ...resolvedCurrent,
    status: currentHasMoreSteps ? resolvedCurrent?.status ?? base.status : resolvedCanonical?.status ?? resolvedCurrent?.status ?? base.status,
    lastUpdatedAt,
    deployment: resolvedCurrent?.deployment ?? resolvedCanonical?.deployment ?? deployment ?? undefined,
    funding: resolvedCurrent?.funding ?? resolvedCanonical?.funding,
    onchainOs: resolvedCurrent?.onchainOs ?? resolvedCanonical?.onchainOs,
    execution: resolvedCurrent?.execution ?? resolvedCanonical?.execution,
    runId: resolvedCurrent?.runId ?? resolvedCanonical?.runId,
    proposalId: resolvedCurrent?.proposalId ?? resolvedCanonical?.proposalId,
    shopIds: {
      ...(resolvedCanonical?.shopIds ?? {}),
      ...(resolvedCurrent?.shopIds ?? {}),
    },
    serviceIds: {
      ...(resolvedCanonical?.serviceIds ?? {}),
      ...(resolvedCurrent?.serviceIds ?? {}),
    },
    firstTaxWei: resolvedCurrent?.firstTaxWei ?? resolvedCanonical?.firstTaxWei,
    secondTaxWei: resolvedCurrent?.secondTaxWei ?? resolvedCanonical?.secondTaxWei,
    txHashes: mergeTxHashes(
      resolvedCanonical?.txHashes,
      resolvedCurrent?.txHashes,
    ) as LiveRuntimeArtifact["txHashes"],
    steps: mergeSteps(
      resolvedCanonical?.steps,
      resolvedCurrent?.steps,
    ),
    error:
      currentHasMoreSteps && resolvedCurrent?.status === "failed"
        ? resolvedCurrent.error
        : resolvedCurrent?.error ?? resolvedCanonical?.error,
  } satisfies LiveRuntimeArtifact;
}

export async function recoverRuntimeSnapshot(
  current: LiveRuntimeArtifact | null,
): Promise<RuntimeRecoverySnapshot> {
  const deployment = await readArtifact<DeploymentArtifact>(DEPLOYMENT_ARTIFACT_PATH);
  const canonical = await selectCanonicalRuntime(deployment);
  const runtime = mergeRuntimeArtifacts(current, canonical, deployment);
  const recovered =
    Boolean(canonical) &&
    (!current ||
      !runtimeContainsAllCanonicalSteps(current, canonical) ||
      (runtime?.txHashes.length ?? 0) > (current?.txHashes.length ?? 0));

  return {
    runtime,
    recovered,
    canonical,
  };
}

export async function restoreCanonicalRuntimeSnapshot(
  current: LiveRuntimeArtifact | null,
) {
  const deployment = await readArtifact<DeploymentArtifact>(DEPLOYMENT_ARTIFACT_PATH);
  const canonical = await selectCanonicalRuntime(deployment);
  if (!canonical) {
    return current ? ensureDeployRuntime(current, deployment) : null;
  }

  return {
    ...canonical,
    funding: current?.funding ?? canonical.funding,
    onchainOs: current?.onchainOs ?? canonical.onchainOs,
    execution: current?.execution ?? canonical.execution,
    lastUpdatedAt: current?.lastUpdatedAt ?? canonical.lastUpdatedAt,
    status: canonical.status ?? current?.status ?? "ready",
    error: undefined,
  } satisfies LiveRuntimeArtifact;
}
