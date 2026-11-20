from pathlib import Path


class ScopedFS:
    """Filesystem access confined to one root (stand-in for a scoped filesystem MCP server)."""

    def __init__(self, root: Path):
        self.root = root

    def _safe(self, rel: str) -> Path:
        p = (self.root / rel).resolve()
        if not p.is_relative_to(self.root.resolve()):
            raise PermissionError(f"Path escapes scope: {rel}")
        return p

    def write(self, rel: str, text: str) -> Path:
        p = self._safe(rel)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)
        return p

    def read(self, rel: str) -> str:
        return self._safe(rel).read_text()

    def exists(self, rel: str) -> bool:
        return self._safe(rel).exists()
