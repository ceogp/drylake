# DryLake Bedrock Claude Setup

DryLake can run hosted planning through Amazon Bedrock Runtime using Claude models and the Converse API.

## Environment

Set the backend provider to native Bedrock Anthropic:

```env
AI_PROVIDER="bedrock_anthropic"
BEDROCK_API_KEY="..."
BEDROCK_REGION="us-east-1"
BEDROCK_FREE_MODEL="anthropic.claude-haiku-4-5-20251001-v1:0"
BEDROCK_MODEL="anthropic.claude-sonnet-4-6"
BEDROCK_CODING_MODEL="anthropic.claude-opus-4-8"
```

DryLake also accepts `AWS_BEARER_TOKEN_BEDROCK` for the Bedrock bearer token. For compatibility with older local files, `BEDROCK_OPENAI_API_KEY` is accepted as a fallback by the native Claude provider, but new deployments should use `BEDROCK_API_KEY`.

The default planning mapping is:

| DryLake use | Environment variable | Default model |
|---|---|---|
| Free user planning | `BEDROCK_FREE_MODEL` | `anthropic.claude-haiku-4-5-20251001-v1:0` |
| Paid/foundation planning | `BEDROCK_MODEL` | `anthropic.claude-sonnet-4-6` |
| Coding/deep analysis | `BEDROCK_CODING_MODEL` | `anthropic.claude-opus-4-8` |

DryLake accepts either a Bedrock model ID or an inference profile ID in these variables. If AWS rejects a US-region `anthropic.*` model ID because on-demand throughput is not supported, DryLake retries the request with the matching `us.anthropic.*` inference profile ID.

## Secrets Manager

If `SECRETS_PROVIDER="aws_secrets_manager"`, store the Bedrock API key as:

```text
<AWS_SECRETS_PREFIX>/bedrock-api-key
```

The default prefix is:

```text
xupra-drylake
```

## Model Validation

Run:

```bash
npm run check:bedrock:claude
```

The check makes a tiny Bedrock Converse request for each configured Claude model and reports whether the account, region, API key, and model ID work together. It does not print credentials.

If AWS returns an access, quota, or model identifier error, verify the exact model ID or inference profile ID in the Bedrock console for the selected region/account and update the corresponding environment variable.

## References

- Amazon Bedrock API keys: https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html
- Use an Amazon Bedrock API key: https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html
- Bedrock Converse API: https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html
