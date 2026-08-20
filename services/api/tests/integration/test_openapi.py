from __future__ import annotations

from fastapi import FastAPI

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
        "getManatalMigrationStatus",
        "inviteTenantMember",
        "listAccessRequests",
        "listApplicationNotes",
        "listApplicationTags",
        "listCandidateNotes",
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
        "listTenantMembers",
        "listTenantTags",
        "listTenantTrackedLinks",
        "listTrackedJobLinks",
        "logIn",
        "logOut",
        "makeMyCvCurrent",
        "markMyNotificationAsRead",
        "messageApplicant",
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
        "tagApplication",
        "tagCandidate",
        "untagApplication",
        "untagCandidate",
        "uploadMyCv",
        "withdrawMyApplication",
        "writeApplicationNote",
        "writeCandidateNote",
    ]
