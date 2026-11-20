from dataclasses import dataclass

from app.agents.crypto_specialist.agent import CryptoSpecialistAgent
from app.agents.manager.agent import ManagerAgent
from app.agents.pentester.agent import PentesterAgent
from app.agents.risk_assessor.agent import RiskAssessorAgent
from app.agents.sast_reviewer.agent import SastReviewerAgent
from app.agents.security_implementer.agent import SecurityImplementerAgent
from app.config import settings
from app.events.event_bus import hub
from app.tools.file_manager import ScopedFS


@dataclass
class PipelineState:
    mission: object
    sandbox: ScopedFS

    def __post_init__(self):
        self.hub = hub
        self.manager = ManagerAgent(hub)
        self.risk, self.sast = RiskAssessorAgent(hub), SastReviewerAgent(hub)
        self.pentest, self.implementer = PentesterAgent(hub), SecurityImplementerAgent(hub)
        self.crypto = CryptoSpecialistAgent(hub)


def new_state(mission):
    return PipelineState(mission, ScopedFS(settings.sandbox_dir))
