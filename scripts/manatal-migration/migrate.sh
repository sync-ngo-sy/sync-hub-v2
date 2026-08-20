#!/usr/bin/env bash
# Run this to migrate Manatal into Sync.
#
# It does nothing clever: it checks first, asks before writing anything, and stops on the first
# thing that is not right. Everything it does can be done by hand with `uv run migrate.py`; this
# exists so nobody has to know that.

set -uo pipefail
cd "$(dirname "$0")"

if ! command -v uv >/dev/null 2>&1; then
  printf '\n  uv is not installed, and this needs it to run.\n'
  printf '  Install it from https://docs.astral.sh/uv/ and run this again.\n\n'
  exit 1
fi

printf '\n  Manatal to Sync migration\n  =========================\n\n'
printf '  Step 1 of 3: checking that everything is ready. Nothing is changed by this.\n\n'

if ! uv run migrate.py --check; then
  printf '\n  Something above is not ready yet. Nothing has been changed.\n'
  printf '  Fix the items marked STOP and run this again.\n\n'
  exit 1
fi

printf '\n  Step 2 of 3: moving people across.\n\n'
printf '  This can take a while, and it says how far along it is as it goes. It is safe to stop\n'
printf '  it and start it again: it remembers what it has done and picks up where it left off.\n\n'
printf '  Type yes to start, or press Enter to stop: '
read -r go
if [ "${go:-}" != "yes" ]; then
  printf '\n  Stopped. Nothing has been changed.\n\n'
  exit 0
fi

uv run migrate.py
moved=$?

printf '\n  Step 3 of 3: what happened.\n\n'
uv run migrate.py --report

if [ "$moved" -ne 0 ]; then
  printf '\n  Some people did not move across. Running this again retries only those.\n\n'
fi

printf '\n  The CVs that were moved still have to be read by the platform before those profiles\n'
printf '  are filled in. Once that has happened, run this again to finish them.\n\n'
exit "$moved"
