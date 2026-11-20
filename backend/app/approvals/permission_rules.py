"""Policy: agents may only write under ./sandbox/ and only after human approval."""
WRITE_ROOT = "sandbox"
REQUIRES_APPROVAL = ("write_sandbox",)
