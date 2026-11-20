import asyncio


class ApprovalManager:
    """Human checkpoint: the pipeline awaits a decision from the UI."""

    def __init__(self):
        self._fut: asyncio.Future | None = None

    async def wait_for_decision(self) -> bool:
        self._fut = asyncio.get_running_loop().create_future()
        return await self._fut

    def decide(self, approved: bool) -> bool:
        if not self._fut or self._fut.done():
            return False
        self._fut.set_result(approved)
        return True


approvals = ApprovalManager()
