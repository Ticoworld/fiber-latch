/**
 * Phase 3 Fiber Routing/Liquidity Diagnostics
 * 
 * Scope: read-only first, then tiny-amount payment attempts only.
 * No secrets, keys, or runtime files committed.
 * All outputs sanitized before logging.
 * 
 * Run: node scripts/phase3-routing-diagnostics.mjs
 */

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

const LOCAL_RPC   = "http://127.0.0.1:8227";
const NODE1_RPC   = "http://18.162.235.225:8227";
const NODE2_RPC   = "http://18.163.221.211:8227";

// Known pubkeys from Phase 2G docs (full values needed for RPC params).
// These are public node pubkeys — not secrets.
// node1 pubkey was partially shown as 02b6d4e3...302be71
// node2 pubkey was partially shown as 0291a657...912fcc
// We will discover them fresh via node_info.

function mask(s) {
  if (!s || typeof s !== "string") return s;
  if (s.length <= 12) return s;
  return s.slice(0, 8) + "..." + s.slice(-6);
}

function maskHex(s) {
  if (!s || typeof s !== "string") return s;
  if (!s.startsWith("0x") || s.length <= 14) return s;
  return s.slice(0, 10) + "..." + s.slice(-6);
}

function maskInvoice(s) {
  if (!s || typeof s !== "string") return s;
  if (s.length <= 16) return s;
  return s.slice(0, 12) + "..." + s.slice(-6);
}

async function rpc(url, method, params = [{}]) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json();
    if (body.error) return { ok: false, error: body.error, body };
    return { ok: true, result: body.result, body };
  } catch (e) {
    return { ok: false, error: { message: e.message }, body: null };
  }
}

async function step(label, fn) {
  console.log(`\n>>> ${label}`);
  try {
    const r = await fn();
    return r;
  } catch (e) {
    console.error(`    ERROR: ${e.message}`);
    return null;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function hexToDecimal(h) {
  if (!h || !h.startsWith("0x")) return h;
  try { return BigInt(h).toString(); } catch { return h; }
}

function hexToShannons(h) {
  if (!h || !h.startsWith("0x")) return null;
  try { return BigInt(h); } catch { return null; }
}

function ckbFromShannons(h) {
  const s = hexToShannons(h);
  if (s == null) return null;
  return (Number(s) / 100_000_000).toFixed(4) + " CKB";
}

// ── main ─────────────────────────────────────────────────────────────────────

const RESULTS = {};

// 1. Reachability and node pubkeys
const localInfo  = await step("LOCAL node_info",  () => rpc(LOCAL_RPC,  "node_info", [{}]));
const node1Info  = await step("NODE1 node_info",   () => rpc(NODE1_RPC,  "node_info", [{}]));
const node2Info  = await step("NODE2 node_info",   () => rpc(NODE2_RPC,  "node_info", [{}]));

const localPubkey  = localInfo?.result?.node_id   ?? localInfo?.result?.pubkey ?? null;
const node1Pubkey  = node1Info?.result?.pubkey ?? null;
const node2Pubkey  = node2Info?.result?.pubkey ?? null;

RESULTS.nodeInfo = {
  local: {
    reachable: localInfo?.ok ?? false,
    version:   localInfo?.result?.version ?? null,
    pubkeyMasked: mask(localPubkey),
    channelCount: localInfo?.result?.channel_count ?? null,
    peersCount: localInfo?.result?.peers_count ?? null,
  },
  node1: {
    reachable: node1Info?.ok ?? false,
    version:   node1Info?.result?.version ?? null,
    nodeName:  node1Info?.result?.node_name ?? null,
    pubkeyMasked: mask(node1Pubkey),
    channelCount: node1Info?.result?.channel_count ?? null,
  },
  node2: {
    reachable: node2Info?.ok ?? false,
    version:   node2Info?.result?.version ?? null,
    nodeName:  node2Info?.result?.node_name ?? null,
    pubkeyMasked: mask(node2Pubkey),
    channelCount: node2Info?.result?.channel_count ?? null,
  },
};

console.log(JSON.stringify(RESULTS.nodeInfo, null, 2));

// 2. Full local channel state
const localChannels = await step("LOCAL list_channels (all)", () =>
  rpc(LOCAL_RPC, "list_channels", [{ limit: 100 }])
);

function sanitizeChannel(ch) {
  return {
    channelIdMasked:     maskHex(ch.channel_id),
    channelOutpointMasked: maskHex(ch.channel_outpoint),
    stateName:           ch.state_name ?? ch.state?.state_name ?? null,
    stateFlags:          ch.state?.state_flags ?? null,
    fundingUdtTypeScript: ch.funding_udt_type_script ?? null,
    localBalance:        ch.local_balance,
    localBalanceCkb:     ckbFromShannons(ch.local_balance),
    remoteBalance:       ch.remote_balance,
    remoteBalanceCkb:    ckbFromShannons(ch.remote_balance),
    offeredTlcBalance:   ch.offered_tlc_balance,
    receivedTlcBalance:  ch.received_tlc_balance,
    localReserveBalance: ch.local_reserve_balance ?? ch.to_local_amount_limit ?? null,
    remoteReserveBalance:ch.remote_reserve_balance ?? null,
    minTlcValue:         ch.min_tlc_value ?? null,
    maxTlcValue:         ch.max_tlc_value ?? null,
    feeRatePerKw:        ch.commitment_fee_rate ?? ch.fee_rate_per_kw ?? null,
    isPublic:            ch.is_public,
    enabled:             ch.enabled,
    peerIdMasked:        mask(ch.peer_id),
    failureDetail:       ch.failure_detail ?? null,
    createdAt:           ch.created_at ?? null,
    // effective outbound = localBalance - localReserve (if field exists)
    _effectiveOutboundEstimate: (() => {
      const lb = hexToShannons(ch.local_balance);
      const rv = hexToShannons(ch.local_reserve_balance ?? ch.to_local_amount_limit ?? null);
      if (lb == null) return null;
      if (rv == null) return `unknown reserve; localBalance=${ckbFromShannons(ch.local_balance)}`;
      const eff = lb - rv;
      return `${eff >= 0n ? eff.toString() : "NEGATIVE"} shannons (${(Number(eff < 0n ? 0n : eff)/1e8).toFixed(4)} CKB) after reserve`;
    })(),
  };
}

const rawChannels = localChannels?.result?.channels ?? [];
RESULTS.localChannels = {
  count: rawChannels.length,
  channels: rawChannels.map(sanitizeChannel),
};
console.log(JSON.stringify(RESULTS.localChannels, null, 2));

// 3. Local peers list
const localPeers = await step("LOCAL list_peers", () =>
  rpc(LOCAL_RPC, "list_peers", [{}])
);
const rawPeers = localPeers?.result?.peers ?? localPeers?.result ?? [];
RESULTS.localPeers = {
  count: Array.isArray(rawPeers) ? rawPeers.length : "unknown",
  peers: Array.isArray(rawPeers) ? rawPeers.map(p => ({
    nodeIdMasked: mask(p.id ?? p.peer_id ?? p.node_id),
    address:      [].concat(p.addresses ?? p.connected_addresses ?? p.address ?? []).map(a => typeof a === "string" && a.includes("ip4") ? a : mask(a)),
    connected:    p.is_connected ?? p.connected ?? null,
  })) : rawPeers,
};
console.log(JSON.stringify(RESULTS.localPeers, null, 2));

// 4. Node1 to Node2 channels (read from node1, looking for outbound capacity toward node2)
let node2PubkeyForQuery = node2Pubkey;
RESULTS.node1ToNode2 = { queried: false, note: null };

if (node1Pubkey && node2PubkeyForQuery) {
  const n1n2 = await step("NODE1 list_channels for node2", () =>
    rpc(NODE1_RPC, "list_channels", [{ pubkey: node2PubkeyForQuery, limit: 200 }])
  );
  const n1n2Channels = n1n2?.result?.channels ?? [];
  const ckbOnly = n1n2Channels.filter(c => !c.funding_udt_type_script);
  const ready = ckbOnly.filter(c => (c.state_name ?? c.state?.state_name) === "ChannelReady");

  // From node1's perspective, local_balance means node1's outbound capacity toward that channel
  // For a node1->node2 channel, local_balance is what node1 can forward to node2
  RESULTS.node1ToNode2 = {
    queried: n1n2?.ok ?? false,
    totalChannels: n1n2Channels.length,
    ckbOnlyChannels: ckbOnly.length,
    readyCkbChannels: ready.length,
    // sample of ready channels showing balances
    readySample: ready.slice(0, 3).map(c => ({
      channelIdMasked: maskHex(c.channel_id),
      stateName: c.state_name ?? c.state?.state_name,
      localBalance: c.local_balance,
      localBalanceCkb: ckbFromShannons(c.local_balance),
      remoteBalance: c.remote_balance,
      isPublic: c.is_public,
    })),
  };
  console.log(JSON.stringify(RESULTS.node1ToNode2, null, 2));
} else {
  console.log("  Cannot query node1->node2: missing pubkeys");
  console.log(`  node1Pubkey present: ${!!node1Pubkey}, node2Pubkey present: ${!!node2PubkeyForQuery}`);
}

// 5. Check local graph for node1 and node2 channel entries
// list_channels with a peer_pubkey set to node1 to see if local graph has directional updates
const localGraphToNode1 = await step("LOCAL list_channels filtered to node1", () =>
  rpc(LOCAL_RPC, "list_channels", [{ peer_id: node1Pubkey, limit: 20 }])
);
const lgCh1 = localGraphToNode1?.result?.channels ?? [];
RESULTS.localGraphToNode1 = {
  queried: localGraphToNode1?.ok ?? false,
  error: localGraphToNode1?.error ?? null,
  channelCount: lgCh1.length,
  channels: lgCh1.map(sanitizeChannel),
};
console.log(JSON.stringify(RESULTS.localGraphToNode1, null, 2));

// 6. Test tiny invoice amounts on node2
// Amounts to test (in shannons):
//   0x3e8    = 1,000     shannons  (~0.00001 CKB)  — minimum viable
//   0x2710   = 10,000    shannons  (~0.0001 CKB)
//   0xf4240  = 1,000,000 shannons  (~0.01 CKB)
//   0x5f5e100 = 100,000,000 shannons = 1 CKB  (previous attempt that failed)

const TEST_AMOUNTS = [
  { hex: "0x3e8",     shannons: 1000n,       label: "1000 shannons (~0.00001 CKB)" },
  { hex: "0x2710",    shannons: 10000n,      label: "10,000 shannons (~0.0001 CKB)" },
  { hex: "0xf4240",   shannons: 1000000n,    label: "1,000,000 shannons (~0.01 CKB)" },
];

RESULTS.amountTests = [];

for (const amt of TEST_AMOUNTS) {
  console.log(`\n>>> Testing invoice amount: ${amt.label}`);
  const amtResult = { amount: amt.hex, label: amt.label };

  // Create fresh node2 invoice
  const inv = await rpc(NODE2_RPC, "new_invoice", [{
    amount: amt.hex,
    currency: "Fibt",
    description: "FiberLatch Phase3 routing diagnostic",
    expiry: "0xe10",
  }]);

  if (!inv.ok) {
    amtResult.invoiceCreated = false;
    amtResult.invoiceError = inv.error?.message ?? "failed";
    RESULTS.amountTests.push(amtResult);
    console.log(JSON.stringify(amtResult, null, 2));
    continue;
  }

  const invResult = inv.result ?? inv.body?.result ?? {};
  const invoiceAddress = invResult.invoice_address;
  // payment_hash can be nested
  const paymentHash = invResult.payment_hash
    ?? invResult?.invoice?.data?.payment_hash
    ?? null;

  if (!invoiceAddress || !paymentHash) {
    amtResult.invoiceCreated = false;
    amtResult.invoiceError = "missing invoice_address or payment_hash in response";
    RESULTS.amountTests.push(amtResult);
    console.log(JSON.stringify(amtResult, null, 2));
    continue;
  }

  amtResult.invoiceCreated = true;
  amtResult.invoiceMasked = maskInvoice(invoiceAddress);
  amtResult.paymentHashMasked = maskHex(paymentHash);

  // Verify invoice is Open
  const getInv = await rpc(NODE2_RPC, "get_invoice", [{ payment_hash: paymentHash }]);
  amtResult.initialInvoiceStatus = getInv?.result?.status ?? getInv?.result?.invoice?.status ?? "unknown";

  // Dry-run automatic send_payment (dry_run flag)
  const dryAuto = await rpc(LOCAL_RPC, "send_payment", [{
    invoice: invoiceAddress,
    dry_run: true,
  }]);
  amtResult.dryRunAuto = dryAuto.ok
    ? { status: dryAuto.result?.status, fee: dryAuto.result?.fee }
    : { error: dryAuto.error?.message ?? "failed" };

  // Dry-run trampoline through node1
  let dryTrampolineResult = null;
  if (node1Pubkey) {
    const dryTramp = await rpc(LOCAL_RPC, "send_payment", [{
      invoice: invoiceAddress,
      trampoline_hops: [node1Pubkey],
      dry_run: true,
    }]);
    dryTrampolineResult = dryTramp.ok
      ? { status: dryTramp.result?.status, fee: dryTramp.result?.fee }
      : { error: dryTramp.error?.message ?? "failed" };
  }
  amtResult.dryRunTrampoline = dryTrampolineResult;

  // Decide whether to attempt real send
  // Only attempt real send if:
  //   (a) dry-run trampoline succeeded (status Created), AND
  //   (b) amount is tiny (<= 0x2710 = 10000 shannons)
  const dryOk = dryTrampolineResult && !dryTrampolineResult.error;
  const isTiny = amt.shannons <= 10000n;

  amtResult.realSendAttempted = false;

  if (dryOk && isTiny) {
    console.log(`  Dry-run trampoline succeeded for ${amt.label} — attempting real send`);
    const realSend = await rpc(LOCAL_RPC, "send_payment", [{
      invoice: invoiceAddress,
      trampoline_hops: [node1Pubkey],
    }]);
    amtResult.realSendAttempted = true;
    amtResult.realSend = realSend.ok
      ? { status: realSend.result?.status, fee: realSend.result?.fee, paymentHashMasked: maskHex(realSend.result?.payment_hash) }
      : { error: realSend.error?.message ?? "failed" };

    // Wait 5 seconds then check payment and invoice state
    if (realSend.ok) {
      await new Promise(r => setTimeout(r, 5000));
      const getPayment = await rpc(LOCAL_RPC, "get_payment", [{ payment_hash: paymentHash }]);
      amtResult.getPaymentStatus = getPayment?.result?.status ?? getPayment?.error?.message ?? "unknown";

      const finalInvoice = await rpc(NODE2_RPC, "get_invoice", [{ payment_hash: paymentHash }]);
      amtResult.finalInvoiceStatus = finalInvoice?.result?.status ?? finalInvoice?.result?.invoice?.status ?? "unknown";
      amtResult.paidReached = amtResult.finalInvoiceStatus === "Paid";
    }
  } else if (dryOk && !isTiny) {
    amtResult.realSendSkipped = `dry-run succeeded but amount ${amt.label} > 10000 shannons safe threshold — skipping real send, trying next smaller amount`;
  } else {
    amtResult.realSendSkipped = `dry-run failed — not attempting real send`;
  }

  RESULTS.amountTests.push(amtResult);
  console.log(JSON.stringify(amtResult, null, 2));
}

// 7. If any tiny amount succeeded, attempt FiberLatch verification
const succeededPayment = RESULTS.amountTests.find(t => t.paidReached);
RESULTS.fiberLatchVerification = { attempted: false, reason: null };

if (succeededPayment) {
  console.log("\n>>> A payment succeeded! Recording paid hash for FiberLatch verification...");
  // The actual payment_hash is available in memory but not printed.
  // We record that verification should be run with npm run fiber:testnet:verify
  RESULTS.fiberLatchVerification = {
    attempted: false,
    reason: "paid hash exists — run: FIBER_CLIENT_MODE=real FIBER_NETWORK=testnet FIBER_RPC_URL=http://18.163.221.211:8227 FIBER_MANUAL_PAYMENT_HASH=<paid_hash> npm run fiber:testnet:verify",
    paidAmountLabel: succeededPayment.label,
    paidInvoiceMasked: succeededPayment.invoiceMasked,
    paymentHashMasked: succeededPayment.paymentHashMasked,
  };
} else {
  RESULTS.fiberLatchVerification = {
    attempted: false,
    reason: "no payment reached Paid status — FiberLatch verification not run",
  };
}

// 8. Channel reserve analysis
RESULTS.channelReserveAnalysis = {};
const ch0 = rawChannels[0];
if (ch0) {
  const lb = hexToShannons(ch0.local_balance);
  const rb = hexToShannons(ch0.remote_balance);
  const offeredTlc = hexToShannons(ch0.offered_tlc_balance);
  const receivedTlc = hexToShannons(ch0.received_tlc_balance);
  const reserveField = ch0.local_reserve_balance ?? ch0.to_local_amount_limit ?? ch0.remote_reserve_balance ?? null;
  const totalChannel = (lb ?? 0n) + (rb ?? 0n);

  // Fiber/Lightning typically requires a channel reserve = 1% of channel capacity
  // or a minimum of the dust limit. Let's compute 1% to see if that explains the issue.
  const estimatedReserve1pct = totalChannel / 100n;
  const effectiveOutboundAfter1pct = lb != null ? lb - estimatedReserve1pct : null;

  RESULTS.channelReserveAnalysis = {
    localBalanceShannons: lb?.toString() ?? null,
    localBalanceCkb: ckbFromShannons(ch0.local_balance),
    remoteBalanceShannons: rb?.toString() ?? null,
    remoteBalanceCkb: ckbFromShannons(ch0.remote_balance),
    offeredTlcBalance: offeredTlc?.toString() ?? null,
    receivedTlcBalance: receivedTlc?.toString() ?? null,
    reserveFieldFromRpc: reserveField,
    totalChannelShannons: totalChannel?.toString() ?? null,
    totalChannelCkb: ckbFromShannons("0x" + totalChannel?.toString(16)),
    estimated1pctReserveShannons: estimatedReserve1pct?.toString() ?? null,
    effectiveOutboundAfter1pctReserve: effectiveOutboundAfter1pct != null
      ? `${effectiveOutboundAfter1pct.toString()} shannons (${(Number(effectiveOutboundAfter1pct)/1e8).toFixed(4)} CKB)`
      : null,
    previousFailedAmountShannons: "100000000",
    hypothesis: effectiveOutboundAfter1pct != null && effectiveOutboundAfter1pct < 100_000_000n
      ? "CONFIRMED: 1% channel reserve would reduce effective outbound below 1 CKB (previous failed amount)"
      : "1% reserve alone does not explain the failure — another constraint may be active",
  };
}
console.log("\n>>> Channel reserve analysis:");
console.log(JSON.stringify(RESULTS.channelReserveAnalysis, null, 2));

// 9. Summary
RESULTS.summary = {
  localNodeReachable: RESULTS.nodeInfo.local.reachable,
  node1Reachable: RESULTS.nodeInfo.node1.reachable,
  node2Reachable: RESULTS.nodeInfo.node2.reachable,
  localChannelCount: RESULTS.localChannels.count,
  paidPaymentAchieved: !!succeededPayment,
  fiberLatchVerificationRun: RESULTS.fiberLatchVerification.attempted,
  amountTestResults: RESULTS.amountTests.map(t => ({
    amount: t.label,
    invoiceCreated: t.invoiceCreated,
    dryRunAutoOk: !t.dryRunAuto?.error,
    dryRunTrampolineOk: !t.dryRunTrampoline?.error,
    realSendAttempted: t.realSendAttempted,
    paidReached: t.paidReached ?? false,
  })),
};

console.log("\n>>> SUMMARY:");
console.log(JSON.stringify(RESULTS.summary, null, 2));

// Save sanitized output
const outPath = "C:/Users/timot/Desktop/2026/CKB/fiber-latch/scripts/_phase3-routing-diagnostics-output.json";
writeFileSync(outPath, JSON.stringify(RESULTS, null, 2), "utf8");
console.log(`\nSanitized output saved to: ${outPath}`);
