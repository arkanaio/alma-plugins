# ChatGPT licenses

Reads the active members of a ChatGPT Enterprise or Edu workspace and the seat
each one holds. It uses the
[ChatGPT Admin API](https://chatgpt.com/public/admin/api-reference#tag/Workspace-Users)
at `api.chatgpt.com` and nothing else.

ChatGPT workspace seats and the members of an OpenAI API Platform organization
are different products. This connector reads the ChatGPT workspace only; API
Platform usage is billed by consumption and is out of its scope.

## Which plans it covers

The Admin API, and the workspace-scoped Admin keys it needs, are documented for
ChatGPT Enterprise and Edu workspaces. OpenAI does not document it for ChatGPT
Business (formerly Team), Plus or Pro. On a workspace whose plan does not offer
the API, OpenAI answers `404` and the read fails with `permissions`; that
workspace is managed in ALMA by hand.

## Authorization

A workspace owner or admin creates an Admin key in the
[OpenAI Admin Console](https://admin.openai.com/credentials?tab=admin-keys),
Credentials, Admin keys, chooses the workspace and **Custom** permissions, and
sets only **Users** to **Read**. That is the `chatgpt.enterprise.user.read`
scope. The key is shown once; it is given to the host together with the
workspace ID.

- `configuration.workspace_id`: the workspace ID, a UUID.
- `secrets.api_key`: the Admin key. It travels only in the `Authorization`
  header.

The connector only reads. It never needs `chatgpt.enterprise.user.write` or any
Compliance API scope, and a key with those permissions would give it more than
it uses. OpenAI records every call to this endpoint in the workspace audit log
as `LIST_WORKSPACE_USERS`.

## What it reads

`GET /v1/manage/workspaces/{workspace_id}/users` lists the active members of the
workspace in ascending user ID order, up to 1,000 per page, which is also the
contract's limit. Each member is one seat, with the OpenAI user ID, email and
name. The cursor is the last user ID read, which OpenAI takes as `after`.

Each seat type is a plan, identified as `{workspace_id}/{seat_type}`:

| `seat_type` | Plan name |
| --- | --- |
| `chatgpt` | ChatGPT |
| `codex` | Codex |

A page returns the plans its seats belong to, always with the same values. A
seat type OpenAI adds later and this connector does not know fails the read
with `contract` (`unknown_seat_type`) instead of being guessed: it may or may
not be a paid seat, and only a reviewed version can say.

## Data and limits

- **Purchased seats.** `seatCount` is always `null`. The Admin API does not
  publish how many seats the workspace bought, and the number of members is
  never used in its place.
- **Who is read.** Active members only. OpenAI excludes removed and inactive
  members and service accounts. Pending invitations are not members yet and are
  not read. Every role is read, owners and admins included, because each member
  holds a seat.
- **Consistency.** OpenAI serves this list from an eventually consistent index:
  a member added or removed moments before a read may be missing or still
  present until the next one.
- **Emails.** A member whose email OpenAI does not return, or returns in a shape
  that is not an email, keeps its user ID and name and has a `null` email. The
  host treats it as an account it cannot match to a person.
- **Prices, currency and billing cycle** are always `null`. The API does not
  expose them.
- **Activity** is not declared (`activity: null`) and `lastActivityAt` is always
  `null`. The Admin API's per-user Daily Usage rows could say when a member last
  used ChatGPT, but they need a second scope (`enterprise.analytics.usage.read`)
  and a scan of daily rows; that is left for a later, separately reviewed
  version.
- **Failures.** 401 is `credentials`; 403 (the key lacks Users read) and 404 (a
  wrong workspace ID, or a plan without the API) are `permissions`; 429 and 5xx
  are retryable `service` failures. A response in another shape and a cursor
  that does not advance are `contract` failures. No failure carries the response
  body.

## Verification and release

The sample responses in `sample-data/` are synthetic and contain no customer
data. The tests serve them through the real `createConnectorFetch` built from
this manifest's `allowedHosts`, and never contact OpenAI. Build with
`pnpm --filter @arkanaio/connector-chatgpt-licenses build` and run
`pnpm verify` before review.
