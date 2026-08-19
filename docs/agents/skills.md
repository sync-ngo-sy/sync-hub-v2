# Skills Tree

Where the agent skills live, and which file decides what.

## One tree, two paths

The skills are committed once, under `.claude/skills/`. The other path is a symlink:

```text
.agents/skills -> ../.claude/skills
```

Two runtimes read the same files from the two names — Claude Code reads `.claude/skills/`,
Codex reads `.agents/skills`. The repo already uses this method for its instruction file
(`AGENTS.md -> CLAUDE.md`), and for the same reason.

The reason is drift. Committed twice, the copies diverge and no check finds it, because each
copy passes every check on its own. It had already happened here:
`web-design-guidelines/agents/openai.yaml` existed in the `.agents/` copy only (#328). That file
is Codex's own descriptor for the skill, and it carries `allow_implicit_invocation: false`, so
the difference was live configuration rather than a stray file. Nothing reported it, and
collapsing the two copies without looking would have deleted it.

`scripts/check-skills-tree.sh` asserts the symlink against the git index, and CI runs it in the
`Repository format` job. It reads the index rather than the working tree because a symlink git
recorded as a directory of files still puts the duplicate in the repository.

## Authority: the tree, not the lockfile

**The tree is authoritative.** It is what both runtimes load, and nothing in this repo generates
it. To change a skill's behaviour, edit the tree.

**`skills-lock.json` is a provenance record, not a build input.** For each vendored skill it
names the upstream repo, the path to its `SKILL.md` there, and the hash it carried when it was
vendored. Nothing in this repo reads the file; no script regenerates the tree from it, and no
check compares the two.

So the lockfile does not gate the tree, and the two are allowed to disagree:

- A skill can be in the tree and absent from the lockfile. `web-design-guidelines` is — it is
  local, not vendored from `mattpocock/skills` or `supabase/agent-skills`.
- A lockfile hash can be stale against the tree. That records that a vendored skill was edited
  locally after it arrived. It is a note about where the file came from, not a rule about what
  the file may now contain.

Read the lockfile to answer "where did this skill come from, and is it ours to edit here?" A
skill listed there is vendored: correct it upstream, then re-vendor. A skill absent from it is
this repo's own.

## CodeQL

`.github/workflows/codeql.yml` excludes both paths, and says why in the file. The short version
is that an alert in vendored code is corrected upstream, so it arrives here with no action
attached to it.
