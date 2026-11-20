import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from app.llm.base import CodeGenerationError, check_python, extract_code, generate_python  # noqa: E402

GOOD = "import os\n\ndef f():\n    return 1\n\nx = f()\nprint(x)\n"


class Fake:
    def __init__(self, *replies):
        self.replies, self.calls = list(replies), 0

    async def chat(self, system, user):
        self.calls += 1
        r = self.replies.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def test_extract_variants():
    assert extract_code(f"```python\n{GOOD}```") == GOOD
    assert extract_code(f"Sure!\n```python\n{GOOD}") == GOOD            # truncated, unterminated fence
    assert extract_code(f"<think>hmm ```python\nbad\n```</think>```py\n{GOOD}```") == GOOD
    assert extract_code(GOOD) == GOOD                                     # no fence at all


def test_check_python_rejects_empty_and_broken():
    assert check_python("\n")
    assert check_python("def f(:\n    pass\n\n\n\n")
    assert check_python(GOOD) is None


def test_retries_then_succeeds():
    llm = Fake("I cannot do that", "```python\ndef f(:\n```", f"```python\n{GOOD}```")
    assert asyncio.run(generate_python(llm, "s", "u")) == GOOD and llm.calls == 3


def test_recovers_from_request_error():
    llm = Fake(RuntimeError("boom"), f"```python\n{GOOD}```")
    assert asyncio.run(generate_python(llm, "s", "u")) == GOOD


def test_gives_up_with_clear_error():
    import pytest

    with pytest.raises(CodeGenerationError):
        asyncio.run(generate_python(Fake("x", "y", "z"), "s", "u"))
