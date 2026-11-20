import asyncio


class BaseAgent:
    id = ""
    name = ""

    def __init__(self, hub):
        self.hub = hub

    def working(self, msg):
        self.hub.emit(self.id, "working", msg)

    def done(self, msg):
        self.hub.emit(self.id, "done", msg)

    def screen(self, lines):
        self.hub.screen(self.id, lines)

    @staticmethod
    async def think(seconds=1.6):
        await asyncio.sleep(seconds)  # pacing so the office animation is readable
