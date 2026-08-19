from __future__ import annotations

from typing import Annotated, Any, Final

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import AfterValidator, BaseModel, EmailStr, Field

from sync_api.auth import ActingProfile, SignedIn
from sync_api.auth.password_policy import (
    CONFORMING_EXAMPLE,
    MAXIMUM_PASSWORD_LENGTH,
    POLICY_SUMMARY,
)
from sync_api.dependencies import AuthServiceDep, CurrentProfileDep, SessionCookiesDep
from sync_api.errors import openapi_problem
from sync_api.rate_limit import enforce_auth_rate_limit, enforce_password_change_rate_limit
from sync_api.text import OptionalIsoCountry, without_control_characters
from sync_core.models import AccountType

ROUTER_PREFIX: Final = "/auth"

RateLimited = Depends(enforce_auth_rate_limit)

IDENTITY_PROVIDER_UNAVAILABLE: Final[dict[int | str, dict[str, Any]]] = {
    502: openapi_problem("The identity provider is not answering.")
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["auth"])

Password = Annotated[
    str,
    Field(
        min_length=1,
        max_length=MAXIMUM_PASSWORD_LENGTH,
        description="The password on the account.",
        examples=[CONFORMING_EXAMPLE],
    ),
]

NewPassword = Annotated[
    str,
    Field(
        max_length=MAXIMUM_PASSWORD_LENGTH,
        description=POLICY_SUMMARY,
        examples=[CONFORMING_EXAMPLE],
    ),
]

EmailToken = Annotated[
    str,
    Field(min_length=1, max_length=512, description="The `token_hash` from the emailed link."),
]


class ProfileView(BaseModel):
    """The acting Profile, as every auth route reports it."""

    id: str = Field(description="Shared with the Supabase Auth user and the Candidate row.")
    email: EmailStr
    full_name: str
    account_type: AccountType
    avatar_url: str | None
    phone: str | None = Field(default=None, description="In E.164.")
    phone_country: OptionalIsoCountry = None

    @classmethod
    def of(cls, profile: ActingProfile) -> ProfileView:
        return cls(
            id=str(profile.id),
            email=profile.email,
            full_name=profile.full_name,
            account_type=profile.account_type,
            avatar_url=profile.avatar_url,
            phone=profile.phone,
            phone_country=profile.phone_country,
        )


class SignUpRequest(BaseModel):
    email: EmailStr
    password: NewPassword
    full_name: Annotated[
        str, AfterValidator(without_control_characters), Field(min_length=1, max_length=200)
    ]


class LogInRequest(BaseModel):
    email: EmailStr
    password: Password


class ConfirmEmailRequest(BaseModel):
    token_hash: EmailToken


class PasswordResetRequest(BaseModel):
    email: EmailStr


class ConfirmPasswordResetRequest(BaseModel):
    token_hash: EmailToken
    password: NewPassword


class AcceptInviteRequest(BaseModel):
    token_hash: EmailToken
    password: NewPassword


class ChangePasswordRequest(BaseModel):
    current_password: Password
    new_password: NewPassword


@router.post(
    "/signup",
    operation_id="signUp",
    summary="Create a candidate account",
    status_code=status.HTTP_201_CREATED,
    dependencies=[RateLimited],
    responses={
        409: openapi_problem("An account already exists for this email address."),
        400: openapi_problem("The password does not meet the policy, or was rejected upstream."),
        **IDENTITY_PROVIDER_UNAVAILABLE,
    },
)
async def sign_up(body: SignUpRequest, auth: AuthServiceDep) -> ProfileView:
    """Create the identity, Profile and Candidate, and email a confirmation link. No session yet."""
    profile = await auth.register_candidate(
        email=body.email, password=body.password, full_name=body.full_name
    )
    return ProfileView.of(profile)


@router.post(
    "/confirm-email",
    operation_id="confirmEmail",
    summary="Confirm an email address",
    dependencies=[RateLimited],
    responses={
        400: openapi_problem("The link is invalid, spent, or expired."),
        **IDENTITY_PROVIDER_UNAVAILABLE,
    },
)
async def confirm_email(
    body: ConfirmEmailRequest,
    auth: AuthServiceDep,
    cookies: SessionCookiesDep,
    response: Response,
) -> ProfileView:
    """Redeem the `token_hash` from the confirmation email, and sign the candidate in."""
    return _signed_in(await auth.confirm_email(body.token_hash), cookies, response)


@router.post(
    "/accept-invite",
    operation_id="acceptInvite",
    summary="Accept a teammate invitation",
    dependencies=[RateLimited],
    responses={
        400: openapi_problem("The link is spent or expired, or the password was refused."),
        **IDENTITY_PROVIDER_UNAVAILABLE,
    },
)
async def accept_invite(
    body: AcceptInviteRequest,
    auth: AuthServiceDep,
    cookies: SessionCookiesDep,
    response: Response,
) -> ProfileView:
    """Redeem the `token_hash` from an invite email, choose a password, and sign in."""
    return _signed_in(
        await auth.accept_invite(token_hash=body.token_hash, password=body.password),
        cookies,
        response,
    )


@router.post(
    "/login",
    operation_id="logIn",
    summary="Start a session",
    dependencies=[RateLimited],
    responses={
        401: openapi_problem("The email and password do not match an account."),
        403: openapi_problem("The email address has not been confirmed yet."),
        **IDENTITY_PROVIDER_UNAVAILABLE,
    },
)
async def log_in(
    body: LogInRequest,
    auth: AuthServiceDep,
    cookies: SessionCookiesDep,
    response: Response,
) -> ProfileView:
    return _signed_in(
        await auth.log_in(email=body.email, password=body.password), cookies, response
    )


@router.post(
    "/refresh",
    operation_id="refreshSession",
    summary="Rotate the session",
    dependencies=[RateLimited],
    responses={
        401: openapi_problem("The session is over — sign in again."),
        **IDENTITY_PROVIDER_UNAVAILABLE,
    },
)
async def refresh_session(
    request: Request,
    auth: AuthServiceDep,
    cookies: SessionCookiesDep,
    response: Response,
) -> ProfileView:
    """Exchange the refresh cookie for a new session, and replace both cookies with it."""
    signed_in = await auth.refresh(cookies.read_refresh_token(request))
    return _signed_in(signed_in, cookies, response)


@router.post(
    "/logout",
    operation_id="logOut",
    summary="End the session",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[RateLimited],
)
async def log_out(request: Request, auth: AuthServiceDep, cookies: SessionCookiesDep) -> Response:
    """Revoke every session the caller has, then clear their cookies. Never fails."""
    await auth.log_out(cookies.read_access_token(request))
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    cookies.clear(response)
    return response


@router.get(
    "/me",
    operation_id="getCurrentProfile",
    summary="The signed-in Profile",
    responses={401: openapi_problem("There is no valid session.")},
)
async def get_current_profile(profile: CurrentProfileDep) -> ProfileView:
    """Who the session cookie belongs to, once Supabase has verified its token."""
    return ProfileView.of(profile)


@router.post(
    "/password-reset",
    operation_id="requestPasswordReset",
    summary="Ask for a password-reset email",
    status_code=status.HTTP_202_ACCEPTED,
    response_class=Response,
    dependencies=[RateLimited],
    responses=IDENTITY_PROVIDER_UNAVAILABLE,
)
async def request_password_reset(body: PasswordResetRequest, auth: AuthServiceDep) -> Response:
    """Send the reset email, if the address has an account. Accepted either way."""
    await auth.request_password_reset(body.email)
    return Response(status_code=status.HTTP_202_ACCEPTED)


@router.post(
    "/password-reset/confirm",
    operation_id="confirmPasswordReset",
    summary="Set a new password",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[RateLimited],
    responses={
        400: openapi_problem("The link is spent or expired, or the password was refused."),
        **IDENTITY_PROVIDER_UNAVAILABLE,
    },
)
async def confirm_password_reset(
    body: ConfirmPasswordResetRequest, auth: AuthServiceDep, cookies: SessionCookiesDep
) -> Response:
    """Redeem the `token_hash` from the reset email, set the new password, and end every session."""
    await auth.reset_password(token_hash=body.token_hash, password=body.password)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    cookies.clear(response)
    return response


@router.post(
    "/password",
    operation_id="changePassword",
    summary="Change the caller's password",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[Depends(enforce_password_change_rate_limit)],
    responses={
        400: openapi_problem("The new password does not meet the policy, or is the current one."),
        401: openapi_problem("There is no valid session, or the current password is wrong."),
        **IDENTITY_PROVIDER_UNAVAILABLE,
    },
)
async def change_password(
    body: ChangePasswordRequest,
    profile: CurrentProfileDep,
    auth: AuthServiceDep,
    cookies: SessionCookiesDep,
) -> Response:
    """Set a new password from inside the account, without an inbox round trip.

    Every session the account has open ends here, so a password changed because it leaked takes
    the account back from whoever was holding it. The caller alone is signed in again before
    answering, and carries on with the session in the cookie this sets.
    """
    session = await auth.change_password(
        profile, current_password=body.current_password, new_password=body.new_password
    )
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    cookies.issue(response, session)
    return response


def _signed_in(signed_in: SignedIn, cookies: SessionCookiesDep, response: Response) -> ProfileView:
    cookies.issue(response, signed_in.session)
    return ProfileView.of(signed_in.profile)
