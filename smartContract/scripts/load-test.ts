import { network } from "hardhat";
import "dotenv/config";

const { ethers } = await network.create();

// ============================================================
//  CONFIGURATION
// ============================================================
const BATCH_SIZES = [1, 10, 50, 100, 200];
const SEED_COUNT = 200;         // Certificates for read/verify tests
const REVOKE_SEED_COUNT = 361;  // Certificates for revoke tests (1+10+50+100+200)

// ============================================================
//  TYPES
// ============================================================
interface RequestResult {
  success: boolean;
  timeMs: number;
  gasUsed?: bigint;
  error?: string;
}

interface BatchResult {
  testName: string;
  functionName: string;
  operationType: string;
  batchSize: number;
  totalRequests: number;
  successCount: number;
  failCount: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  stdDevMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  totalMs: number;
  throughput: number;
  avgGas?: bigint;
  totalGas?: bigint;
}

// ============================================================
//  STATISTICS HELPERS
// ============================================================
function calcMin(arr: number[]): number {
  return Math.min(...arr);
}

function calcMax(arr: number[]): number {
  return Math.max(...arr);
}

function calcAvg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calcStdDev(arr: number[]): number {
  const avg = calcAvg(arr);
  const squareDiffs = arr.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / arr.length);
}

function calcPercentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function pad(str: string, len: number): string {
  return str.padEnd(len);
}

function padStart(str: string, len: number): string {
  return str.padStart(len);
}

// ============================================================
//  MAIN
// ============================================================
async function main() {
  console.log("");
  console.log("================================================================");
  console.log("  CONCURRENT LOAD TEST — AcademicCertificate Smart Contract");
  console.log("================================================================");
  console.log(`  Batch Sizes   : ${BATCH_SIZES.join(", ")}`);
  console.log(`  Functions     : 5 (register, get, verify, verifyById, revoke)`);
  console.log(`  Network       : Hardhat In-Memory EDR (Chain ID 31337)`);
  console.log("================================================================\n");

  const [owner, ...otherSigners] = await ethers.getSigners();

  // ----------------------------------------------------------
  //  PHASE 1: Deploy Contract
  // ----------------------------------------------------------
  console.log("[SETUP] Deploying AcademicCertificate contract...");
  const Factory = await ethers.getContractFactory("AcademicCertificate");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`        Contract address : ${contractAddress}`);

  const addIssuerTx = await contract.addIssuer(owner.address, "Load Test Admin");
  await addIssuerTx.wait();
  console.log(`        Issuer registered: ${owner.address}\n`);

  // ----------------------------------------------------------
  //  PHASE 2: Seed Certificates
  // ----------------------------------------------------------
  // 2a. Seed for read/verification tests
  console.log(`[SETUP] Seeding ${SEED_COUNT} certificates for read/verification tests...`);
  const readDocIds: string[] = [];
  const cidMap: Map<string, string> = new Map();

  for (let i = 0; i < SEED_COUNT; i++) {
    const docId = `READ-${String(i + 1).padStart(4, "0")}`;
    const cid = `bafybereadtest${String(i + 1).padStart(4, "0")}cidplaceholder`;
    const wallet = otherSigners[i % otherSigners.length].address;

    const tx = await contract.registerCertificate(
      docId, cid,
      `Student Read ${i + 1}`,
      `130202200${String(i + 1).padStart(4, "0")}`,
      wallet, "S1", "Teknik Informatika",
      `ipfs://bafkreimeta${String(i + 1).padStart(4, "0")}read`
    );
    await tx.wait();
    readDocIds.push(docId);
    cidMap.set(docId, cid);

    if ((i + 1) % 50 === 0 || i === SEED_COUNT - 1) {
      console.log(`        Seeded [${i + 1}/${SEED_COUNT}]`);
    }
  }

  // 2b. Seed for revoke tests
  console.log(`[SETUP] Seeding ${REVOKE_SEED_COUNT} certificates for revocation tests...`);
  const revokeDocIds: string[] = [];

  for (let i = 0; i < REVOKE_SEED_COUNT; i++) {
    const docId = `REVOKE-${String(i + 1).padStart(4, "0")}`;
    const cid = `bafyberevoke${String(i + 1).padStart(4, "0")}cidplaceholder`;
    const wallet = otherSigners[i % otherSigners.length].address;

    const tx = await contract.registerCertificate(
      docId, cid,
      `Student Revoke ${i + 1}`,
      `130202299${String(i + 1).padStart(4, "0")}`,
      wallet, "S1", "Teknik Informatika",
      `ipfs://bafkreimeta${String(i + 1).padStart(4, "0")}revoke`
    );
    await tx.wait();
    revokeDocIds.push(docId);

    if ((i + 1) % 100 === 0 || i === REVOKE_SEED_COUNT - 1) {
      console.log(`        Seeded [${i + 1}/${REVOKE_SEED_COUNT}]`);
    }
  }

  console.log(`[SETUP] Seeding complete. Total on-chain: ${SEED_COUNT + REVOKE_SEED_COUNT}\n`);

  const allResults: BatchResult[] = [];

  // ==============================================================
  //  TEST 1: registerCertificate() — WRITE
  // ==============================================================
  console.log("================================================================");
  console.log("  TEST 1: registerCertificate()");
  console.log("  Type: WRITE (state-changing transaction, mints SBT)");
  console.log("================================================================\n");

  let regCounter = 0;
  for (const batchSize of BATCH_SIZES) {
    const docIds = Array.from({ length: batchSize }, (_, i) => {
      regCounter++;
      return `REG-${String(regCounter).padStart(4, "0")}`;
    });

    const result = await runWriteBatch(
      contract, owner, "registerCertificate", "WRITE", batchSize,
      async (nonce, index) => {
        const docId = docIds[index];
        const cid = `bafybereg${String(regCounter - batchSize + index + 1).padStart(4, "0")}cid`;
        const wallet = otherSigners[index % otherSigners.length].address;
        return contract.registerCertificate(
          docId, cid,
          `Student Reg ${regCounter - batchSize + index + 1}`,
          `130202288${String(index + 1).padStart(4, "0")}`,
          wallet, "S1", "Teknik Informatika",
          `ipfs://bafkreireg${String(index + 1).padStart(4, "0")}`,
          { nonce }
        );
      }
    );
    allResults.push(result);
  }

  // ==============================================================
  //  TEST 2: getCertificate() — VIEW
  // ==============================================================
  console.log("\n================================================================");
  console.log("  TEST 2: getCertificate()");
  console.log("  Type: VIEW (read-only, no gas cost)");
  console.log("================================================================\n");

  for (const batchSize of BATCH_SIZES) {
    const selectedDocs = readDocIds.slice(0, batchSize);
    const result = await runReadBatch(
      "getCertificate", "VIEW", batchSize,
      selectedDocs.map((docId) => async () => {
        const res = await contract.getCertificate(docId);
        if (!res[0].exists) throw new Error("Certificate not found");
        return res;
      })
    );
    allResults.push(result);
  }

  // ==============================================================
  //  TEST 3: verifyCertificate() — STATIC CALL
  // ==============================================================
  console.log("\n================================================================");
  console.log("  TEST 3: verifyCertificate()");
  console.log("  Type: STATIC CALL (read simulation, emits event on-chain)");
  console.log("================================================================\n");

  for (const batchSize of BATCH_SIZES) {
    const selectedDocs = readDocIds.slice(0, batchSize);
    const result = await runReadBatch(
      "verifyCertificate", "STATIC CALL", batchSize,
      selectedDocs.map((docId) => async () => {
        const cid = cidMap.get(docId)!;
        const res = await contract.verifyCertificate.staticCall(docId, cid);
        if (res[0] !== true || res[1] !== true) {
          throw new Error("Verification returned invalid result");
        }
        return res;
      })
    );
    allResults.push(result);
  }

  // ==============================================================
  //  TEST 4: verifyByDocumentId() — VIEW
  // ==============================================================
  console.log("\n================================================================");
  console.log("  TEST 4: verifyByDocumentId()");
  console.log("  Type: VIEW (read-only, QR code verification)");
  console.log("================================================================\n");

  for (const batchSize of BATCH_SIZES) {
    const selectedDocs = readDocIds.slice(0, batchSize);
    const result = await runReadBatch(
      "verifyByDocumentId", "VIEW", batchSize,
      selectedDocs.map((docId) => async () => {
        const res = await contract.verifyByDocumentId(docId);
        if (!res[0].isValid) throw new Error("Certificate not valid");
        return res;
      })
    );
    allResults.push(result);
  }

  // ==============================================================
  //  TEST 5: revokeCertificate() — WRITE
  // ==============================================================
  console.log("\n================================================================");
  console.log("  TEST 5: revokeCertificate()");
  console.log("  Type: WRITE (state-changing transaction, burns SBT)");
  console.log("================================================================\n");

  let revokeOffset = 0;
  for (const batchSize of BATCH_SIZES) {
    const batchDocs = revokeDocIds.slice(revokeOffset, revokeOffset + batchSize);
    revokeOffset += batchSize;

    const result = await runWriteBatch(
      contract, owner, "revokeCertificate", "WRITE", batchSize,
      async (nonce, index) => {
        return contract.revokeCertificate(batchDocs[index], { nonce });
      }
    );
    allResults.push(result);
  }

  // ==============================================================
  //  RESULTS
  // ==============================================================
  printDetailedResults(allResults);
  printSummaryTable(allResults);
  printStabilityVerdict(allResults);
}

// ============================================================
//  RUN READ BATCH (VIEW / STATIC CALL)
// ============================================================
async function runReadBatch(
  functionName: string,
  operationType: string,
  batchSize: number,
  callFns: (() => Promise<any>)[]
): Promise<BatchResult> {
  console.log(`  [Batch ${batchSize}] Sending ${batchSize} concurrent requests...`);

  const results: RequestResult[] = [];
  const batchStart = Date.now();

  const promises = callFns.map(async (fn) => {
    const start = Date.now();
    try {
      await fn();
      results.push({ success: true, timeMs: Date.now() - start });
    } catch (err: any) {
      results.push({
        success: false,
        timeMs: Date.now() - start,
        error: err.message?.substring(0, 100),
      });
    }
  });

  await Promise.all(promises);
  const batchElapsed = Date.now() - batchStart;

  return buildBatchResult(functionName, operationType, batchSize, results, batchElapsed);
}

// ============================================================
//  RUN WRITE BATCH (TRANSACTION WITH NONCE MANAGEMENT)
// ============================================================
async function runWriteBatch(
  contract: any,
  signer: any,
  functionName: string,
  operationType: string,
  batchSize: number,
  txFactory: (nonce: number, index: number) => Promise<any>
): Promise<BatchResult> {
  console.log(`  [Batch ${batchSize}] Sending ${batchSize} concurrent transactions...`);

  const baseNonce = await signer.getNonce();
  const results: RequestResult[] = [];
  const batchStart = Date.now();

  const promises = Array.from({ length: batchSize }, async (_, index) => {
    const nonce = baseNonce + index;
    const start = Date.now();
    try {
      const tx = await txFactory(nonce, index);
      const receipt = await tx.wait();
      results.push({
        success: true,
        timeMs: Date.now() - start,
        gasUsed: receipt?.gasUsed ?? 0n,
      });
    } catch (err: any) {
      results.push({
        success: false,
        timeMs: Date.now() - start,
        error: err.message?.substring(0, 100),
      });
    }
  });

  await Promise.all(promises);
  const batchElapsed = Date.now() - batchStart;

  return buildBatchResult(functionName, operationType, batchSize, results, batchElapsed);
}

// ============================================================
//  BUILD BATCH RESULT
// ============================================================
function buildBatchResult(
  functionName: string,
  operationType: string,
  batchSize: number,
  results: RequestResult[],
  batchElapsed: number
): BatchResult {
  const successResults = results.filter((r) => r.success);
  const failResults = results.filter((r) => !r.success);

  const times = results.map((r) => r.timeMs);
  const successTimes = successResults.map((r) => r.timeMs);

  const minMs = times.length > 0 ? calcMin(times) : 0;
  const maxMs = times.length > 0 ? calcMax(times) : 0;
  const avgMs = times.length > 0 ? calcAvg(times) : 0;
  const stdDevMs = times.length > 0 ? calcStdDev(times) : 0;
  const p50Ms = times.length > 0 ? calcPercentile(times, 50) : 0;
  const p95Ms = times.length > 0 ? calcPercentile(times, 95) : 0;
  const p99Ms = times.length > 0 ? calcPercentile(times, 99) : 0;
  const throughput = batchElapsed > 0 ? batchSize / (batchElapsed / 1000) : 0;

  // Gas calculation for write operations
  const gasValues = successResults
    .filter((r) => r.gasUsed !== undefined && r.gasUsed > 0n)
    .map((r) => r.gasUsed!);

  const avgGas = gasValues.length > 0
    ? gasValues.reduce((a, b) => a + b, 0n) / BigInt(gasValues.length)
    : undefined;
  const totalGas = gasValues.length > 0
    ? gasValues.reduce((a, b) => a + b, 0n)
    : undefined;

  // Print per-batch summary
  const failStr = failResults.length > 0 ? ` | FAILED: ${failResults.length}` : "";
  const gasStr = avgGas ? ` | Avg Gas: ${avgGas.toString()}` : "";
  console.log(
    `           Success: ${successResults.length}/${batchSize}${failStr} | ` +
    `Total: ${batchElapsed}ms | Avg: ${avgMs.toFixed(1)}ms | ` +
    `P95: ${p95Ms.toFixed(1)}ms | Throughput: ${throughput.toFixed(1)} req/s${gasStr}`
  );

  // Print failures if any
  for (const f of failResults) {
    console.log(`           FAIL: ${f.error}`);
  }

  return {
    testName: `${functionName}`,
    functionName,
    operationType,
    batchSize,
    totalRequests: batchSize,
    successCount: successResults.length,
    failCount: failResults.length,
    minMs, maxMs, avgMs, stdDevMs,
    p50Ms, p95Ms, p99Ms,
    totalMs: batchElapsed,
    throughput,
    avgGas,
    totalGas,
  };
}

// ============================================================
//  PRINT DETAILED RESULTS PER FUNCTION
// ============================================================
function printDetailedResults(results: BatchResult[]) {
  console.log("\n\n================================================================");
  console.log("  DETAILED RESULTS PER FUNCTION");
  console.log("================================================================");

  const functionNames = [...new Set(results.map((r) => r.functionName))];

  for (const fn of functionNames) {
    const fnResults = results.filter((r) => r.functionName === fn);
    const opType = fnResults[0].operationType;

    console.log(`\n  ---- ${fn}() [${opType}] ----`);
    console.log(
      `  ${padStart("Batch", 6)} | ${padStart("OK", 4)} | ${padStart("Fail", 4)} | ` +
      `${padStart("Min(ms)", 9)} | ${padStart("Avg(ms)", 9)} | ${padStart("P50(ms)", 9)} | ` +
      `${padStart("P95(ms)", 9)} | ${padStart("P99(ms)", 9)} | ${padStart("Max(ms)", 9)} | ` +
      `${padStart("StdDev", 8)} | ${padStart("Total(ms)", 10)} | ${padStart("TPS", 8)}` +
      (fnResults[0].avgGas !== undefined ? ` | ${padStart("Avg Gas", 10)}` : "")
    );
    console.log("  " + "-".repeat(130));

    for (const r of fnResults) {
      const gasCol = r.avgGas !== undefined ? ` | ${padStart(r.avgGas.toString(), 10)}` : "";
      console.log(
        `  ${padStart(String(r.batchSize), 6)} | ${padStart(String(r.successCount), 4)} | ` +
        `${padStart(String(r.failCount), 4)} | ` +
        `${padStart(r.minMs.toFixed(1), 9)} | ${padStart(r.avgMs.toFixed(1), 9)} | ` +
        `${padStart(r.p50Ms.toFixed(1), 9)} | ${padStart(r.p95Ms.toFixed(1), 9)} | ` +
        `${padStart(r.p99Ms.toFixed(1), 9)} | ${padStart(r.maxMs.toFixed(1), 9)} | ` +
        `${padStart(r.stdDevMs.toFixed(1), 8)} | ${padStart(r.totalMs.toFixed(0), 10)} | ` +
        `${padStart(r.throughput.toFixed(1), 8)}${gasCol}`
      );
    }
  }
}

// ============================================================
//  PRINT SUMMARY TABLE (ALL FUNCTIONS)
// ============================================================
function printSummaryTable(results: BatchResult[]) {
  console.log("\n\n================================================================");
  console.log("  CROSS-FUNCTION COMPARISON TABLE");
  console.log("================================================================\n");

  console.log(
    `  ${pad("Function", 22)} | ${pad("Type", 12)} | ` +
    `${padStart("Batch", 5)} | ${padStart("OK/Total", 8)} | ` +
    `${padStart("Avg(ms)", 9)} | ${padStart("P95(ms)", 9)} | ` +
    `${padStart("Max(ms)", 9)} | ${padStart("TPS", 8)}`
  );
  console.log("  " + "-".repeat(100));

  for (const r of results) {
    console.log(
      `  ${pad(r.functionName, 22)} | ${pad(r.operationType, 12)} | ` +
      `${padStart(String(r.batchSize), 5)} | ${padStart(`${r.successCount}/${r.totalRequests}`, 8)} | ` +
      `${padStart(r.avgMs.toFixed(1), 9)} | ${padStart(r.p95Ms.toFixed(1), 9)} | ` +
      `${padStart(r.maxMs.toFixed(1), 9)} | ${padStart(r.throughput.toFixed(1), 8)}`
    );
  }

  console.log("  " + "-".repeat(100));
}

// ============================================================
//  STABILITY VERDICT
// ============================================================
function printStabilityVerdict(results: BatchResult[]) {
  console.log("\n================================================================");
  console.log("  STABILITY ANALYSIS");
  console.log("================================================================\n");

  const totalRequests = results.reduce((s, r) => s + r.totalRequests, 0);
  const totalSuccess = results.reduce((s, r) => s + r.successCount, 0);
  const totalFail = results.reduce((s, r) => s + r.failCount, 0);
  const successRate = ((totalSuccess / totalRequests) * 100).toFixed(2);

  console.log(`  Total Requests Sent  : ${totalRequests}`);
  console.log(`  Total Success        : ${totalSuccess}`);
  console.log(`  Total Failures       : ${totalFail}`);
  console.log(`  Overall Success Rate : ${successRate}%`);

  // Per-function degradation analysis
  const functionNames = [...new Set(results.map((r) => r.functionName))];

  console.log("\n  ---- Performance Degradation Analysis ----\n");

  for (const fn of functionNames) {
    const fnResults = results.filter((r) => r.functionName === fn);
    if (fnResults.length < 2) continue;

    const first = fnResults[0];
    const last = fnResults[fnResults.length - 1];
    const degradation = first.avgMs > 0
      ? ((last.avgMs - first.avgMs) / first.avgMs) * 100
      : 0;

    const allSuccess = fnResults.every((r) => r.failCount === 0);
    const maxP95 = calcMax(fnResults.map((r) => r.p95Ms));
    const avgThroughput = calcAvg(fnResults.map((r) => r.throughput));

    let verdict = "STABLE";
    if (!allSuccess) {
      verdict = "UNSTABLE — failures detected";
    } else if (degradation > 500) {
      verdict = "STABLE (significant latency increase under high load)";
    } else if (degradation > 100) {
      verdict = "STABLE (moderate latency increase under high load)";
    } else {
      verdict = "STABLE (minimal latency increase)";
    }

    console.log(`  ${fn}():`);
    console.log(`    Batch 1 avg         : ${first.avgMs.toFixed(1)} ms`);
    console.log(`    Batch ${last.batchSize} avg       : ${last.avgMs.toFixed(1)} ms`);
    console.log(`    Latency increase    : +${degradation.toFixed(1)}%`);
    console.log(`    Worst P95           : ${maxP95.toFixed(1)} ms`);
    console.log(`    Avg Throughput      : ${avgThroughput.toFixed(1)} req/s`);
    console.log(`    100% Success        : ${allSuccess ? "YES" : "NO"}`);
    console.log(`    Verdict             : ${verdict}`);
    console.log("");
  }

  // Overall verdict
  const failedBatches = results.filter((r) => r.failCount > 0);

  console.log("  ---- Overall Verdict ----\n");

  if (failedBatches.length === 0) {
    console.log("  VERDICT: STABLE");
    console.log("  All concurrent batches across all 5 functions completed");
    console.log("  with 100% success rate. The system handles up to 200");
    console.log("  concurrent requests without errors or data loss.");
  } else {
    console.log("  VERDICT: PARTIALLY STABLE");
    console.log("  Some batches encountered failures:");
    for (const fb of failedBatches) {
      console.log(`    - ${fb.functionName} batch=${fb.batchSize}: ${fb.failCount} failures`);
    }
  }

  console.log("\n================================================================");
  console.log(`  Batch Sizes Tested      : ${BATCH_SIZES.join(", ")}`);
  console.log(`  Certificates Seeded     : ${SEED_COUNT + REVOKE_SEED_COUNT}`);
  console.log(`  Total Requests Executed : ${totalRequests}`);
  console.log(`  Functions Tested        : ${functionNames.length}`);
  console.log(`  Network                 : Hardhat In-Memory EDR (Chain ID 31337)`);
  console.log("================================================================\n");
}

// ============================================================
//  ENTRY POINT
// ============================================================
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Load test failed:", error.message || error);
    process.exit(1);
  });
