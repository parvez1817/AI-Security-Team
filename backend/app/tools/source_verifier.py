"""Rule-based static checks used by Risk / SAST / Crypto agents and by the final verification pass."""
import ast
import re
import sys

RULES = [  # id, cwe, severity, title, regex, owner agent
    ("HARDCODED_SECRET", "CWE-798", "critical", "Hardcoded secret",
     r"(?i)\b\w*(secret|api_?key|token|passw(or)?d)\w*\s*=\s*[\"'][^\"'{}]{6,}[\"']", "crypto"),
    ("PLAINTEXT_PASSWORD", "CWE-256", "high", "Plaintext password stored or exposed",
     r"(?i)password\s+TEXT|[\"']password[\"']\s*:\s*\w+\[\d+\]", "crypto"),
    ("TOKEN_EXPOSURE", "CWE-200", "high", "Sensitive token returned in response", r"[\"']api_token[\"']\s*:", "crypto"),
    ("WEAK_HASH", "CWE-327", "high", "Weak hash (MD5/SHA1)", r"hashlib\.(md5|sha1)\(", "crypto"),
    ("SQLI", "CWE-89", "critical", "SQL injection via f-string",
     r"(?i)\bf[\"'].*\b(select|insert|update|delete)\b.*\{", "sast"),
    ("CMD_INJECTION", "CWE-78", "critical", "OS command injection (shell=True)", r"shell\s*=\s*True", "sast"),
    ("PICKLE", "CWE-502", "critical", "Insecure deserialization (pickle)", r"\bpickle\.loads?\(", "sast"),
    ("WEAK_TOKEN", "CWE-330", "high", "Predictable, unsigned session token", r"\bf[\"']session_", "risk"),
]
ROUTE = re.compile(
    r"@app\.(get|post|put|delete|patch)\(\s*[\"']([^\"']+)[\"']\s*\)\s*\n\s*(?:async\s+)?def\s+(\w+)\(([^\n]*)\)\s*(?:->[^:\n]+)?:")
GUARD = re.compile(r"Depends|Authorization|Header\(|HTTPBearer|verify_token|current_user")


ROUTE_DECL = re.compile(r"@(?:app|router)\.(get|post|put|delete|patch)\(\s*[\"']([^\"']+)[\"']")


def route_set(code: str) -> set[tuple[str, str]]:
    """(METHOD, path) pairs declared in `code`; tolerant of extra decorator kwargs such as response_model=."""
    return {(m.upper(), p) for m, p in ROUTE_DECL.findall(code)}


def analyze_routes(code: str) -> list[dict]:
    out, ms = [], list(ROUTE.finditer(code))
    for i, m in enumerate(ms):
        method, path, fn, params = m.groups()
        body = code[m.end(): ms[i + 1].start() if i + 1 < len(ms) else len(code)]
        out.append({"method": method.upper(), "path": path, "fn": fn,
                    "line": code.count("\n", 0, m.start()) + 1,
                    "guarded": bool(GUARD.search(params + body)),
                    "public": path in ("/login", "/register") or "health" in path})
    return out


def scan(code: str) -> list[dict]:
    found = []
    for n, line in enumerate(code.splitlines(), 1):
        if line.lstrip().startswith("#"):
            continue
        for rid, cwe, sev, title, pat, owner in RULES:
            if re.search(pat, line):
                found.append({"id": rid, "cwe": cwe, "severity": sev, "title": title, "line": n,
                              "agent": owner, "snippet": line.strip()[:100], "path": None})
    for r in analyze_routes(code):
        if r["guarded"] or r["public"]:
            continue
        if "/admin" in r["path"]:
            rid, cwe, sev, t = "MISSING_RBAC", "CWE-862", "critical", "Admin endpoint without RBAC"
        elif "{" in r["path"]:
            rid, cwe, sev, t = "IDOR", "CWE-639", "high", "Object access without auth/ownership check"
        else:
            rid, cwe, sev, t = "MISSING_AUTH", "CWE-306", "high", "Endpoint without authentication"
        found.append({"id": rid, "cwe": cwe, "severity": sev, "title": f"{t}: {r['method']} {r['path']}",
                      "line": r["line"], "agent": "risk", "snippet": f"{r['method']} {r['path']}", "path": r["path"]})
    return found


def syntax_ok(code: str) -> bool:
    try:
        ast.parse(code)
        return True
    except SyntaxError:
        return False


def overview(code: str) -> dict:
    o = {"lines": len(code.splitlines()), "routes": len(analyze_routes(code)), "functions": 0, "imports": []}
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return {**o, "syntax_error": True}
    o["functions"] = sum(isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) for n in ast.walk(tree))
    mods = {a.name.split(".")[0] for n in ast.walk(tree) if isinstance(n, ast.Import) for a in n.names}
    mods |= {n.module.split(".")[0] for n in ast.walk(tree) if isinstance(n, ast.ImportFrom) and n.module}
    o["imports"] = sorted(mods)
    o["third_party"] = sorted(m for m in mods if m not in sys.stdlib_module_names)
    return o
