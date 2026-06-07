# DryLake Bedrock OpenAI Setup

DryLake can run hosted planning through Amazon Bedrock's OpenAI-compatible Responses API.

## Environment

Set the backend provider to Bedrock:

```env
AI_PROVIDER="bedrock_openai"
BEDROCK_OPENAI_API_KEY="..."
BEDROCK_OPENAI_REGION="us-east-2"
BEDROCK_OPENAI_MODEL="openai.gpt-5.4"
BEDROCK_OPENAI_FREE_MODEL="openai.gpt-5.4-nano"
```

`BEDROCK_OPENAI_BASE_URL` is optional. If unset, DryLake builds:

```text
https://bedrock-mantle.<region>.api.aws/openai/v1
```

The Responses endpoint used by the app is:

```text
https://bedrock-mantle.<region>.api.aws/openai/v1/responses
```

## Secrets Manager

If `SECRETS_PROVIDER="aws_secrets_manager"`, store the Bedrock API key as:

```text
<AWS_SECRETS_PREFIX>/bedrock-openai-api-key
```

The default prefix is:

```text
xupra-drylake
```

## Model Validation

Run:

```bash
npm run check:bedrock:openai
```

The check lists models returned by the Bedrock OpenAI-compatible `/models` endpoint and reports whether the configured foundation and free model IDs are available.

## Current Model Notes

AWS documentation confirms `openai.gpt-5.4` on Bedrock through the `bedrock-mantle` Responses endpoint.

`openai.gpt-5.4-nano` is configured separately so DryLake can use it when the model is exposed in the target AWS account and region. If the smoke check says Nano is not returned by `/models`, keep the provider enabled for `openai.gpt-5.4` and use a supported free-model ID until AWS exposes Nano for the account.
