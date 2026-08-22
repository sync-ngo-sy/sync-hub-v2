from __future__ import annotations

from fastapi import FastAPI

from sync_api.applications import MAX_TICKED_APPLICATIONS
from sync_api.problems import PROBLEM_JSON_MEDIA_TYPE


def error_responses(schema: dict[str, object]) -> list[tuple[str, str, dict[str, object]]]:
    found = []
    paths = schema["paths"]
    assert isinstance(paths, dict)
    for path, path_item in paths.items():
        for method, operation in path_item.items():
            for status_code, response in operation["responses"].items():
                if str(status_code).isdigit() and int(status_code) >= 400:
                    found.append((f"{method.upper()} {path}", status_code, response))
    return found


async def test_errors_are_only_ever_offered_as_problem_json(app: FastAPI) -> None:
    for operation, status_code, response in error_responses(app.openapi()):
        content = response["content"]
        assert isinstance(content, dict)
        assert list(content) == [PROBLEM_JSON_MEDIA_TYPE], (
            f"{operation} advertises {list(content)} for {status_code}"
        )


async def test_error_responses_carry_a_schema(app: FastAPI) -> None:
    for operation, status_code, response in error_responses(app.openapi()):
        content = response["content"]
        assert isinstance(content, dict)
        assert "$ref" in content[PROBLEM_JSON_MEDIA_TYPE]["schema"], (
            f"{operation} describes no body for {status_code}"
        )


async def test_notification_payloads_are_documented_as_a_discriminated_union(
    app: FastAPI,
) -> None:
    schemas = app.openapi()["components"]["schemas"]
    payload = schemas["Notification"]["properties"]["payload"]
    members = {member["$ref"].rsplit("/", 1)[-1] for member in payload["oneOf"]}

    assert members == {"CvParseFailed", "CvParseSucceeded", "ApplicationStageChanged"}
    assert payload["discriminator"]["propertyName"] == "type"
    assert set(payload["discriminator"]["mapping"]) == {
        "cv_parse_failed",
        "cv_parse_succeeded",
        "application_stage_changed",
    }
    for member in members:
        assert "type" in schemas[member]["properties"], f"{member} does not carry the discriminator"


async def test_operations_have_stable_ids(app: FastAPI) -> None:
    paths = app.openapi()["paths"]
    assert isinstance(paths, dict)
    operation_ids = [
        operation["operationId"] for path_item in paths.values() for operation in path_item.values()
    ]

    assert sorted(operation_ids) == [
        "acceptInvite",
        "answerHireClaim",
        "askForAccess",
        "assessApplicationMatch",
        "browseJobs",
        "calculateMyExperienceTotal",
        "changeApplicationStatus",
        "changeJob",
        "changePassword",
        "changeTenantMember",
        "changeTrackedJobLink",
        "confirmEmail",
        "confirmPasswordReset",
        "convertAccessRequest",
        "createJob",
        "createMessageTemplate",
        "createPlatformTenant",
        "createTenantTag",
        "createTrackedJobLink",
        "deleteApplicationNote",
        "deleteCandidateNote",
        "deleteMessageTemplate",
        "deleteMyAccount",
        "deleteMyCv",
        "deleteTenantTag",
        "dismissAccessRequest",
        "dropCandidateFromTalentPool",
        "editApplicationNote",
        "editCandidateNote",
        "getApplication",
        "getCurrentProfile",
        "getHealth",
        "getJob",
        "getJobByTrackedLink",
        "getMessageTemplate",
        "getMyCv",
        "getMyCvDownloadLink",
        "getMyProfile",
        "getMyProfileDraftFromCv",
        "getMyTenant",
        "getMyUnreadNotificationCount",
        "getPlatformOverview",
        "getPublicJob",
        "getReadiness",
        "getTenantStats",
        "inviteTenantMember",
        "listAccessRequests",
        "listApplicationNotes",
        "listApplicationTags",
        "listCandidateNotes",
        "listCandidatePlacements",
        "listCandidateTags",
        "listCanonicalRoles",
        "listCanonicalSkills",
        "listDirectoryCandidates",
        "listJobApplications",
        "listJobs",
        "listLanguages",
        "listLocations",
        "listMessageTemplates",
        "listMyApplications",
        "listMyCvs",
        "listMyNotifications",
        "listPlatformTenants",
        "listTalentPool",
        "listTenantApplications",
        "listTenantHireClaims",
        "listTenantMembers",
        "listTenantTags",
        "listTenantTrackedLinks",
        "listTrackedJobLinks",
        "logIn",
        "logOut",
        "makeMyCvCurrent",
        "markMyNotificationAsRead",
        "messageApplicant",
        "moveTickedApplications",
        "readApplicationMatchAssessment",
        "readDirectoryCandidate",
        "refreshSession",
        "renameTenantTag",
        "replaceJobCriteria",
        "replaceMyAvatar",
        "replaceMyProfile",
        "replaceTenantLogo",
        "requestPasswordReset",
        "resendFoundingAdminInvite",
        "reviseMessageTemplate",
        "saveCandidateToTalentPool",
        "searchCandidates",
        "setPlatformTenantStatus",
        "signUp",
        "submitApplication",
        "sweepJobApplications",
        "sweepTenantApplications",
        "tagApplication",
        "tagCandidate",
        "untagApplication",
        "untagCandidate",
        "uploadMyCv",
        "withdrawMyApplication",
        "writeApplicationNote",
        "writeCandidateNote",
    ]


async def test_a_sweep_asks_for_a_reading_and_never_a_list_of_ids(app: FastAPI) -> None:
    """The whole point of the endpoint: the payload of a sweep of fifty thousand Applications is
    the payload of a sweep of twelve, so no selection is too large to send.

    A sweep names where they go as well as what it moves, and the Tenant-wide one carries the one
    filter the Tenant-wide list adds. Still no ids anywhere, and none possible.
    """
    schemas = app.openapi()["components"]["schemas"]

    assert set(schemas["ApplicationSweep"]["properties"]) == {
        "statuses",
        "to",
        "qualification_statuses",
    }
    assert set(schemas["TenantApplicationSweep"]["properties"]) == {
        "statuses",
        "to",
        "qualification_statuses",
        "received_within",
    }


async def test_only_the_ticked_move_names_ids_and_it_names_nothing_else(app: FastAPI) -> None:
    """The one act a filter cannot describe, and so the one that carries ids. It carries them and
    where they go, and inherits none of the Reading's filters: the ids already are the selection.
    """
    ticked = app.openapi()["components"]["schemas"]["TickedApplicationMove"]

    assert set(ticked["properties"]) == {"ids", "to"}
    assert ticked["properties"]["ids"]["maxItems"] == MAX_TICKED_APPLICATIONS
    assert ticked["properties"]["ids"]["minItems"] == 1
