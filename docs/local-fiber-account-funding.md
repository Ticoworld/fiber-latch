# Phase 2G Report: Secret-Safe Local Account And Funding Prep

Date: 2026-05-24

Scope: account/funding prep only. No FiberLatch product features, UI, API route changes, receipt logic changes, paid verification claims, secrets, keys, keystores, node data, or local runtime files were added to the repo.

## Tooling Status

- `fnn`: available by full path
- `fnn-cli`: available by full path
- `fnn-migrate`: available by full path
- `ckb-cli`: available by full path
- external toolchain directory: `C:\Users\timot\Desktop\2026\CKB\fiber-local-toolchain`
- external runtime directory: `C:\Users\timot\Desktop\2026\CKB\fiber-local-node`
- both external directories exist and are outside the FiberLatch repo

Verified versions:

```text
fnn Fiber v0.8.1 (b560023 2026-04-16)
fnn-cli 0.8.1
fnn-migrate 0.8.1
ckb-cli 2.0.0 (80efc21 2025-12-03)
```

## Account Creation Safety

`ckb-cli account new --help` says:

```text
Create a new account and print related information.
```

`ckb-cli account list --help` documents public listing fields for local filesystem accounts:

- `lock_arg`
- `lock_hash`
- CKB public key derivation root path presence
- `address`

Official Fiber public-node docs instruct users to run `ckb-cli account new`, save the `lock_arg`, and then use a separate `ckb-cli account export --lock-arg <YOUR_LOCK_ARG> --extended-privkey-path ./exported-key` step to export private key material.

Safety decision:

- automated account creation was not run
- the help text does not explicitly guarantee secret-free output
- account creation may expose sensitive material or prompt for secret input in a way this log should not capture
- strict PM call: stop and require a human-run, visual-inspection step
- human later ran account creation manually and pasted back only public fields

## Account Result

- created: yes, by human-run manual command outside Codex execution
- public testnet address masked: `ckt1qzda0c...cq6p4hrw`
- public `lock_arg` masked: `0x8b09b52e...3cd8f060`
- public `lock_hash` masked: `0xf4b223ef...bbded657`
- existing local accounts: yes, `ckb-cli --local-only --output-format json account list` returned one local filesystem account
- private key printed: no
- seed phrase printed: no
- mnemonic printed: no
- password printed: no
- key exported: yes, into the external `nodeA/exported-key` file during manual export
- key copied into Fiber runtime: yes, `nodeA/ckb/key` exists

## Shell Syntax Note

The manual command failed when PowerShell syntax was pasted into Git Bash/MINGW64:

```text
bash: =: command not found
bash: syntax error near unexpected token `&'
```

Reason: `$ckbCli = '...'` and `& $ckbCli ...` are PowerShell syntax, not Bash syntax. In Git Bash, use:

```bash
ckbCli="/c/Users/timot/Desktop/2026/CKB/fiber-local-toolchain/ckb-cli-v2.0.0/ckb-cli_v2.0.0_x86_64-pc-windows-msvc/ckb-cli.exe"
"$ckbCli" --local-only --output-format json account list
```

## Manual Account Creation Instruction

Run this manually in a local PowerShell window, not through Codex, so you can inspect output before sharing anything:

```powershell
$ckbCli = 'C:\Users\timot\Desktop\2026\CKB\fiber-local-toolchain\ckb-cli-v2.0.0\ckb-cli_v2.0.0_x86_64-pc-windows-msvc\ckb-cli.exe'
& $ckbCli --local-only --output-format json account new
```

If prompted for a password, enter a local testnet-only password. Do not paste that password here.

After the command completes, paste back only these public fields if present:

- `lock_arg`
- `lock_hash`
- testnet address, usually under `address.testnet`

Do not paste:

- private key
- extended private key
- mnemonic
- seed phrase
- password
- keystore JSON
- exported-key file contents

If the output contains anything that looks like a private key, mnemonic, seed phrase, or password, do not paste the output. Instead, manually run:

```powershell
& $ckbCli --local-only --output-format json account list
```

Then paste only the public `lock_arg`, `lock_hash`, and testnet address from the account list.

## Funding Requirement

Official Fiber public-node guide funding requirements:

- fund nodeA's address with `10000` CKB for the documented setup
- open the nodeA to public node1 CKB channel with at least `500` CKB because public node1 auto-accept minimum is documented as `438` CKB
- CKB amounts in `fnn-cli` are shannons
- `1 CKB = 100,000,000` shannons
- optional RUSD path requires `20` RUSD; not required for the CKB invoice payer path

Funding source from official Fiber public-node guide:

- CKB faucet: `https://faucet.nervos.org`

Human faucet result:

- faucet page displayed `Claim Success`
- claimed amount displayed: `100000.0` CKB
- target address was the local public testnet address, masked as `ckt1qzda0c...cq6p4hrw`
- on-chain balance/spendability still has not been verified by CLI, but the local node later established a `ChannelReady` channel to public node1

Do not automate faucet funding in this repo.

## Files Changed

- `docs/local-fiber-account-funding.md`
- `docs/local-fiber-toolchain-setup.md`
- `docs/live-fiber-verification-blocker.md`

## Validation Result

- `npm test`: passed, 3 test files, 32 tests
- `npm run build`: passed
- `npm run demo:local-access`: passed, first redemption `GRANTED`, second redemption `DENIED`

## What Is Now Proven

- Local Fiber and CKB CLI tooling remains available.
- External toolchain and runtime directories remain outside the repo.
- A local CKB testnet account exists with public address information captured only in masked form.
- No private key, seed phrase, mnemonic, password, keystore JSON, or exported key was pasted into docs.
- Faucet claim success was observed for the masked public testnet address.
- The exported key file exists at `C:\Users\timot\Desktop\2026\CKB\fiber-local-node\nodeA\ckb\key`.
- Funding requirements and faucet source are documented.

## What Is Still Not Proven

- Remaining unallocated wallet balance has not been rechecked after channel funding.
- Local `fnn` can complete route/liquidity construction to node2.
- A public node2 invoice can be paid.
- FiberLatch can verify a real paid Fiber `payment_hash`.
- FiberLatch can issue a receipt from a live paid Fiber result.

## Exact Next Step

The export/copy step is complete, local `fnn` runs, and the channel to public node1 reached `ChannelReady`. The next proof step is resolving the route/liquidity failure where automatic routing reports `no path found` and trampoline routing through node1 reports `max outbound liquidity 0`, then making a real payment and verifying a paid `payment_hash`.
