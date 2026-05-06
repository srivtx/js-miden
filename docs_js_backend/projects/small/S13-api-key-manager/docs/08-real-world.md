# S13 API Key Manager — Real-World Examples

## Stripe API Keys

Stripe uses `sk_live_`, `sk_test_`, `pk_live_`, `pk_test_` prefixes.
- **Hashing**: Keys are hashed server-side; only the prefix and last 4 characters are shown in the dashboard.
- **Rotation**: Users can roll keys with zero downtime; old keys remain active until explicitly revoked.
- **Scopes**: Restricted keys allow granular permissions (e.g., "read customers only").

## AWS IAM Access Keys

AWS uses `AKIA...` (access key ID) + secret key pairs.
- **Storage**: The secret is shown exactly once on creation. AWS stores only a hash.
- **Rotation**: AWS recommends rotating every 90 days.
- **Scope**: Attached to IAM policies (JSON documents defining permissions).

## GitHub Personal Access Tokens

GitHub PATs use `ghp_`, `github_pat_` prefixes.
- **Expiration**: Fine-grained PATs can expire after a set date.
- **Scope**: Repository-scoped tokens limit access to specific repos.
- **Audit**: Every API call is logged with the token used.

## SendGrid API Keys

SendGrid keys are 69-character opaque strings.
- **Prefix**: `SG.` identifies SendGrid keys in codebases.
- **Scopes**: "Full Access", "Restricted Access", or "Billing Access".

## Data Breaches

### Uber (2016)
Attackers found AWS credentials hardcoded in source code. The keys had excessive permissions and no expiration.

### Tesla (2018)
An unsecured Kubernetes console exposed AWS credentials. Mining malware was deployed using the leaked keys.

### Lesson
- Never commit API keys to version control.
- Rotate keys regularly.
- Use least-privilege scopes.
- Monitor key usage for anomalies.
