"""A Candidate's CVs: uploading one, watching it be read, and getting the file back."""

from sync_api.cvs.payload import Cv, CvDownloadLink
from sync_api.cvs.service import CvService

__all__ = [
    "Cv",
    "CvDownloadLink",
    "CvService",
]
