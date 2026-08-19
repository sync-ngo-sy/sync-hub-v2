#!/usr/bin/env bash
# Asserts the skills tree is in the repository one time: `.claude/skills/` holds the files and
# `.agents/skills` is a symlink to them. `docs/agents/skills.md` gives the reason.
# See https://github.com/sync-ngo-sy/sync-hub-v2/issues/328
#
# It reads the index, not the work tree. A symlink that git recorded as a directory of files is
# again a second copy, and only the index shows which of the two git holds.
set -uo pipefail

REAL=".claude/skills"
LINK=".agents/skills"

fail() {
  printf '::error::%s\n' "$@" >&2
  exit 1
}

# Lexical only: `..` removes the segment before it. The target of a symlink git holds is a
# string in the index, and this must not obey a work tree that can disagree with it.
normalise() {
  local GIVEN="$1" OUT="" PART OLD_IFS="$IFS"
  set -f
  IFS=/
  for PART in ${GIVEN}; do
    case "${PART}" in
      '' | .) ;;
      ..) if [[ "${OUT}" == */* ]]; then OUT="${OUT%/*}"; else OUT=""; fi ;;
      *) OUT="${OUT:+${OUT}/}${PART}" ;;
    esac
  done
  IFS="${OLD_IFS}"
  set +f
  printf '%s' "${OUT}"
}

ROOT="$(git rev-parse --show-toplevel)" || fail "This is not a git repository."
cd "${ROOT}" || fail "Cannot enter ${ROOT}."

MODE="$(git ls-files --stage --full-name -- "${LINK}" | awk '{print $1}' | sort -u)" ||
  fail "Cannot read ${LINK} from the index."

if [[ -z "${MODE}" ]]; then
  fail "${LINK} is not in the index." \
    "Codex reads that path, thus it must be a committed symlink to ${REAL}."
fi

if [[ "${MODE}" != "120000" ]]; then
  COUNT="$(git ls-files -- "${LINK}" | wc -l | tr -d ' ')"
  fail "${LINK} is ${COUNT} committed file(s), not a symlink." \
    "That puts the skills tree in the repository two times. The two copies become different" \
    "and every check obeys each copy alone, thus no check finds the difference." \
    "Keep the files that are in ${LINK} only, then:" \
    "  git rm -r --cached ${LINK} && rm -rf ${LINK}" \
    "  ln -s ../${REAL} ${LINK} && git add ${LINK}"
fi

TARGET="$(git cat-file blob ":${LINK}")" || fail "Cannot read the target of ${LINK} from the index."
RESOLVED="$(normalise "$(dirname "${LINK}")/${TARGET}")"

if [[ "${RESOLVED}" != "${REAL}" ]]; then
  fail "${LINK} points to '${TARGET}', which gives '${RESOLVED}', not ${REAL}." \
    "Make it a symlink to ${REAL}:" \
    "  rm ${LINK} && ln -s ../${REAL} ${LINK} && git add ${LINK}"
fi

if [[ -z "$(git ls-files -- "${REAL}")" ]]; then
  fail "${LINK} points to ${REAL}, which has no committed file." \
    "The symlink is correct and the files it needs are absent."
fi

echo "The skills tree is in the repository one time: ${REAL}, with ${LINK} -> ${TARGET}."
