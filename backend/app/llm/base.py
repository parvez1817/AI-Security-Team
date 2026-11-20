import ast
import re
from abc import ABC, abstractmethod
from collections.abc import Callable


class LLMProvider(ABC):
    @abstractmethod
    async def chat(self, system: str, user: str) -> str: ...


class CodeGenerationError(RuntimeError):
    """The model never produced acceptable Python after all attempts."""


_THINK = re.compile(r"<think>.*?(</think>|$)", re.S | re.I)
_FENCE = re.compile(r"```[ \t]*(?:python|py)?[ \t]*\r?\n(.*?)(?:```|\Z)", re.S | re.I)


def extract_code(text: str) -> str:
    """Pull Python out of an LLM reply.

    Handles reasoning blocks, several fences (picks the longest), and an unterminated
    fence (reply cut off by the token limit). Falls back to the raw text.
    """
    text = _THINK.sub("", text or "")
    blocks = [b for b in _FENCE.findall(text) if b.strip()]
    body = max(blocks, key=len) if blocks else text
    return body.strip() + "\n"


def check_python(code: str, min_lines: int = 5) -> str | None:
    """Return a human-readable problem with `code`, or None if it is acceptable."""
    if len(code.strip().splitlines()) < min_lines:
        return "the file is empty or far too short - return the COMPLETE file"
    try:
        ast.parse(code)
    except SyntaxError as e:
        return f"SyntaxError on line {e.lineno}: {e.msg}"
    return None


async def generate_python(llm: LLMProvider, system: str, user: str, *,
                          validate: Callable[[str], str | None] = check_python, attempts: int = 3) -> str:
    """Ask the model for a Python file, validating it and feeding the problem back on each retry."""
    prompt, last = user, "no attempt made"
    for n in range(1, attempts + 1):
        try:
            reply = await llm.chat(system, prompt)
        except Exception as e:  # network / rate limit - provider already retried transient errors
            last = f"LLM request failed: {e}"
            continue
        code = extract_code(reply)
        problem = validate(code)
        if problem is None:
            return code
        last = problem
        prompt = (f"{user}\n\nYour previous reply was rejected: {problem}.\n"
                  "Reply again with ONLY the complete, valid Python file inside one ```python block. "
                  "No commentary, no truncation, no placeholders.")
    raise CodeGenerationError(f"model did not return valid Python after {attempts} attempts ({last})")
