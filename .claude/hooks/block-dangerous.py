"""PreToolUse hook: block dangerous shell commands that prefix rules can't catch.

Reads the tool call as JSON on stdin. Exit code 2 blocks the call and
shows the stderr message to Claude.
"""
import json
import re
import sys

PATTERNS = [
    # curl/wget output piped straight into a shell: curl x | sh, wget -qO- x | sudo bash
    (r"\b(curl|wget)\b[^|;&]*\|\s*(sudo\s+)?(ba|z|da|k)?sh\b",
     "curl/wget로 받은 스크립트를 바로 실행"),
    # shell reading from a download: bash <(curl x), sh -c "$(curl x)"
    (r"\b(ba|z|da|k)?sh\b[^;&|]*(<\(|\$\()\s*(curl|wget)\b",
     "curl/wget로 받은 스크립트를 바로 실행"),
    # PowerShell: iwr/irm/curl/wget ... | iex, iex (iwr ...)
    (r"\b(iwr|irm|invoke-webrequest|invoke-restmethod|curl|wget)\b[^;]*\|\s*(iex|invoke-expression)\b",
     "다운로드한 스크립트를 바로 실행"),
    (r"\b(iex|invoke-expression)\b\s*\(?\s*\(?\s*(iwr|irm|invoke-webrequest|invoke-restmethod|new-object\s+net\.webclient)",
     "다운로드한 스크립트를 바로 실행"),
    # Backstops for denied commands hidden inside chains or subshells
    (r"(^|[;&|(]\s*|\s)sudo\s", "sudo"),
    (r"\brm\s+(-[a-z]*r[a-z]*f[a-z]*|-[a-z]*f[a-z]*r[a-z]*|-r\s+-f|-f\s+-r)\b", "rm -rf"),
    (r"\bchmod\s+(-R\s+)?0?777\b", "chmod 777"),
    # git force push with the flag anywhere (git push origin main --force),
    # including -f bundled with other short flags (-uf) and +refspec (git push origin +main)
    (r"\bgit\s+push\b[^;&|]*\s(--force(-with-lease|-if-includes)?\b|-[a-z]*f[a-z]*\b|\+\S)",
     "git push --force"),
    (r"\bgit\s+reset\b[^;&|]*\s--hard\b", "git reset --hard"),
    # Recursive deletes, wherever the flag sits: rm -r, rm -R, git rm -r, rm --recursive
    (r"\brm\b[^;&|]*\s(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)\b", "rm -r (폴더 삭제)"),
    # PowerShell: Remove-Item and its aliases with -Recurse (any abbreviation)
    (r"\b(remove-item|ri|del|erase|rd|rmdir)\b[^;&]*\s-r[a-z]*\b", "Remove-Item -Recurse (폴더 삭제)"),
    # cmd.exe: rmdir /s, rd /s, del /s
    (r"\b(rmdir|rd|del|erase)\b[^;&|]*\s/s\b", "rmdir /s (폴더 삭제)"),
    (r"\bgit\s+clean\b", "git clean"),
    (r"\bfind\b[^;&|]*\s-delete\b", "find -delete"),
    (r"\bfind\b[^;]*-exec\s+rm\b", "find -exec rm"),
    # Script one-liners that delete folders
    (r"\bshutil\.rmtree\b", "shutil.rmtree (폴더 삭제)"),
    (r"\.(rm|rmdir)(Sync)?\s*\([^)]*recursive", "fs.rm recursive (폴더 삭제)"),
]

# Commit messages are only text, so blank them out before matching
# (otherwise `git commit -m "explain rm -r"` would be blocked).
# A commit segment runs to the next ; & | that is outside quotes, so every
# -m message is blanked while commands chained after the commit are still checked.
COMMIT_SEGMENT = re.compile(r"""\bgit\s+commit\b(?:"[^"]*"|'[^']*'|[^;&|"'])*""", re.IGNORECASE)
MESSAGE_ARG = re.compile(r"""(\s-m\s*)("[^"]*"|'[^']*')""")


def strip_commit_messages(command):
    return COMMIT_SEGMENT.sub(lambda m: MESSAGE_ARG.sub(r'\1""', m.group(0)), command)


# Permission settings and hooks may be read but not changed from the shell.
# (Edit/Write on these files are blocked by deny rules in settings.json.)
PROTECTED_PATH = re.compile(r"\.claude[\\/]+(settings(\.local)?\.json|hooks\b)", re.IGNORECASE)
WRITE_OPERATION = re.compile(
    r"(?<![0-9&])>(?!&|\s*(/dev/null|\$null)\b)"          # > and >> redirects (not 2>&1, not > /dev/null)
    r"|\bsed\b[^;&|]*\s-i"                                 # sed -i
    r"|\b(tee|truncate|dd|cp|mv|ln|chmod|touch|rm|del|erase|copy|move|ren|rename|rmdir|rd)\b"
    r"|\b(set|add|clear)-content\b|\bout-file\b"
    r"|\b(copy|move|rename|new|remove)-item\b"
    r"|\bgit\s+(checkout|restore|rm|mv|stash)\b"
    r"|open\([^)]*,\s*['\"][wax]|\.write(_text|_bytes|lines)?\s*\(|writeFileSync|appendFileSync",
    re.IGNORECASE,
)


def touches_protected_file(command):
    return bool(PROTECTED_PATH.search(command) and WRITE_OPERATION.search(command))


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0
    command = (data.get("tool_input") or {}).get("command") or ""
    command = strip_commit_messages(command)
    if touches_protected_file(command):
        print("차단됨: 권한 설정 파일(.claude/settings*.json, .claude/hooks)은 셸 명령으로 수정할 수 없습니다.",
              file=sys.stderr)
        return 2
    for pattern, label in PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            print(f"차단됨: '{label}' 명령은 이 프로젝트에서 허용되지 않습니다.", file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
