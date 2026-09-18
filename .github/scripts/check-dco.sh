#!/usr/bin/env bash
#
# Every commit in a pull request must carry a Signed-off-by trailer matching its
# author. That line is the Developer Certificate of Origin 1.1: the author
# states they have the right to contribute the code under this repository's
# license. See CONTRIBUTING.md#license-and-sign-off.
#
# Reads BASE and HEAD from the environment. Merge commits are exempt: nobody
# writes their content.
set -euo pipefail

: "${BASE:?BASE is required}"
: "${HEAD:?HEAD is required}"

missing=0

while IFS=$'\t' read -r sha author email signoffs; do
  [ -n "$sha" ] || continue
  if printf '%s' "$signoffs" | grep -qiF "<$email>"; then
    continue
  fi
  missing=1
  echo "::error::Commit $sha by $author <$email> has no Signed-off-by line matching its author."
  if [ -n "$signoffs" ]; then
    echo "  It is signed off by: $signoffs"
  fi
done < <(
  git log --no-merges \
    --format='%H%x09%aN%x09%aE%x09%(trailers:key=Signed-off-by,valueonly,separator=%x2C )' \
    "$BASE..$HEAD"
)

if [ "$missing" -ne 0 ]; then
  cat <<'MSG'

Add the trailer with `git commit -s`. To fix commits you already made:

    git rebase --signoff BASE
    git push --force-with-lease

where BASE is the commit your branch started from. The name and email in the
sign-off have to be the ones you commit with.
MSG
  exit 1
fi

echo "Every commit is signed off."
