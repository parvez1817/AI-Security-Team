import time

from app.orchestration import nodes
from app.orchestration.state import new_state


async def run_pipeline(mission):
    st = new_state(mission)
    h = st.hub
    mission.status, mission.started = "running", time.time()
    h.publish()
    try:
        for node in (nodes.ingest, nodes.audit):
            await node(st)
        if not await nodes.human_checkpoint(st):
            mission.status = "rejected"
            st.manager.stage("report")
            return
        mission.status = "running"
        st.manager.stage("remediate")
        await nodes.remediate(st)
        await nodes.verify_loop(st)
        st.manager.write_outputs(st)
        v = h.board["verification"]
        mission.status = "completed"
        h.emit("manager", "done", "Verification passed" if v["passed"] else "Finished, some findings remain")
    except Exception as e:  # surface any failure in the UI
        mission.status, mission.error = "failed", str(e)
        h.emit("manager", "rejected", f"Failed: {e}")
    finally:
        mission.ended = time.time()
        h.publish()
