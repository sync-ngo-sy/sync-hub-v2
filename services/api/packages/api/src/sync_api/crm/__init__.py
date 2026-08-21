from sync_api.crm.assignments import ON_APPLICATIONS, ON_CANDIDATES, TagAssignmentService
from sync_api.crm.notes import ABOUT_APPLICATIONS, ABOUT_CANDIDATES, NoteService
from sync_api.crm.payload import (
    NewNote,
    NewTag,
    Note,
    NoteChanges,
    NotePage,
    PooledCandidate,
    Tag,
    TagChanges,
    TalentPoolPage,
)
from sync_api.crm.placements import PlacementService
from sync_api.crm.tags import TagService
from sync_api.crm.talent_pool import TalentPoolOrder, TalentPoolService

__all__ = [
    "ABOUT_APPLICATIONS",
    "ABOUT_CANDIDATES",
    "ON_APPLICATIONS",
    "ON_CANDIDATES",
    "NewNote",
    "NewTag",
    "Note",
    "NoteChanges",
    "NotePage",
    "NoteService",
    "PlacementService",
    "PooledCandidate",
    "Tag",
    "TagAssignmentService",
    "TagChanges",
    "TagService",
    "TalentPoolOrder",
    "TalentPoolPage",
    "TalentPoolService",
]
