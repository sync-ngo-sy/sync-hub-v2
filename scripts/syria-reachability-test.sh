#!/usr/bin/env bash
# Reachability probe for https://github.com/sync-ngo-sy/sync-hub-v2/issues/75
#
# Decides whether we host behind Cloudflare or go all-Google, by measuring which
# vendors' edges actually answer from a Syrian network.
#
#   RUN THIS WITH THE VPN OFF. A VPN invalidates the whole test — geo-blocking keys
#   on the client IP's country, so a foreign exit node passes checks a Syrian IP fails.
#
#   ./scripts/syria-reachability-test.sh          # writes ./reachability-report.txt
#
# The script refuses to draw conclusions if it cannot confirm the connection is Syrian.

set -uo pipefail

REPORT="${1:-./reachability-report.txt}"
ROUNDS=3
TIMEOUT=15

exec > >(tee "$REPORT") 2>&1

echo "=================================================================="
echo " Reachability probe — issue #75"
echo " started: $(date -u '+%Y-%m-%d %H:%M:%SZ') (UTC)"
echo "=================================================================="
echo

# ---------------------------------------------------------------- guard --------
# Cloudflare's trace endpoint reports the country it sees us from, which both
# measures Cloudflare reachability and proves whether the VPN is really off.
echo "--- CONNECTION IDENTITY (is the VPN actually off?) ---"
TRACE=$(curl -s -m "$TIMEOUT" https://cloudflare.com/cdn-cgi/trace || echo "")
if [ -z "$TRACE" ]; then
  echo "  Cloudflare trace endpoint did NOT respond."
  echo "  That is itself a finding: Cloudflare may be unreachable from this network."
  LOC="unknown"
else
  LOC=$(printf '%s' "$TRACE" | awk -F= '/^loc=/{print $2}')
  echo "  public IP  : $(printf '%s' "$TRACE" | awk -F= '/^ip=/{print $2}')"
  echo "  country    : ${LOC:-unknown}"
  echo "  CF edge    : $(printf '%s' "$TRACE" | awk -F= '/^colo=/{print $2}')  (the data centre serving us)"
fi
echo
if [ "$LOC" = "SY" ]; then
  echo "  VALID: connection is Syrian. Results below are meaningful."
else
  echo "  *** WARNING: country is '${LOC}', not SY. ***"
  echo "  *** If a VPN or proxy is on, TURN IT OFF and re-run. These numbers are NOT"
  echo "  *** evidence for issue #75 and must not be pasted into it as such."
fi
echo

# ---------------------------------------------------------------- probes -------
# Each probe reports DNS, TCP, TLS and total time. A completed TLS handshake proves
# the edge is reachable even when the HTTP status is 404 — we are testing the
# network path, not whether a resource exists.
probe() { # probe <label> <url> <why-it-matters>
  local label="$1" url="$2" why="$3"
  printf '%-26s %s\n' "$label" "$why"
  local i
  for i in $(seq 1 "$ROUNDS"); do
    local out
    out=$(curl -o /dev/null -s -m "$TIMEOUT" \
      -w 'status=%{http_code} dns=%{time_namelookup}s tcp=%{time_connect}s tls=%{time_appconnect}s total=%{time_total}s' \
      "$url" 2>&1)
    if [ -n "$out" ] && printf '%s' "$out" | grep -q 'status='; then
      local tls
      tls=$(printf '%s' "$out" | sed -n 's/.*tls=\([0-9.]*\)s.*/\1/p')
      if [ "$tls" = "0.000000" ] || [ -z "$tls" ]; then
        printf '   run %s  %s   <-- NO TLS HANDSHAKE (edge not reached)\n' "$i" "$out"
      else
        printf '   run %s  %s   reachable\n' "$i" "$out"
      fi
    else
      printf '   run %s  FAILED — no response within %ss\n' "$i" "$TIMEOUT"
    fi
  done
  echo
}

echo "--- CLOUDFLARE (needed only if we choose the Cloudflare-fronted design) ---"
probe "cloudflare trace" "https://cloudflare.com/cdn-cgi/trace" "Cloudflare's edge"
probe "cloudflare dns" "https://one.one.one.one/" "a second Cloudflare property"

echo "--- GOOGLE (needed for the all-Google design, which is our preference) ---"
probe "google connectivity" "https://connectivitycheck.gstatic.com/generate_204" "Google's edge in general"
probe "cloud run frontend" "https://probe-nonexistent-8f3a.a.run.app/" "serves every *.run.app; 404 is fine, TLS is the signal"
probe "firebase hosting" "https://probe-nonexistent-8f3a.web.app/" "serves the SPAs in the all-Google design"
probe "cloud storage" "https://storage.googleapis.com/" "Google API surface"
probe "artifact registry" "https://europe-west3-docker.pkg.dev/" "our chosen Frankfurt region"

echo "--- SUPABASE (server-to-server only; the browser never calls it) ---"
probe "supabase.com" "https://supabase.com/" "informational — client reachability is not required"

# ---------------------------------------------------------------- routing ------
echo "--- NETWORK PATH (which way traffic leaves the country) ---"
for host in cloudflare.com storage.googleapis.com; do
  echo "  path to $host:"
  if command -v traceroute >/dev/null 2>&1; then
    traceroute -w 2 -q 1 -m 12 "$host" 2>&1 | sed 's/^/    /'
  else
    echo "    (traceroute not installed — skipping)"
  fi
  echo
done

echo "=================================================================="
echo " Report written to: $REPORT"
echo
echo " Next steps:"
echo "   1. If country above is not SY, the VPN was on. Re-run with it off."
echo "   2. Repeat on a second Syrian ISP — a phone on mobile data is easiest."
echo "   3. Paste this report into issue #75."
echo
echo " How to read it:"
echo "   Google reachable, Cloudflare not  -> all-Google. Skip the DNS migration."
echo "   Both reachable                    -> all-Google anyway (no mail risk)."
echo "   Cloudflare reachable, Google not  -> Cloudflare is mandatory; migrate DNS."
echo "   Neither reachable                 -> stop. Raise before any more infra work."
echo "=================================================================="
