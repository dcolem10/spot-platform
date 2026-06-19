#!/usr/bin/env bash
#
# deploy-backend.sh — deploy backend Lambda *code* via direct update.
#
# `sam deploy` is currently blocked by a CloudFormation EarlyValidation
# ResourceExistenceCheck hook (see backend/CLAUDE.md), so we build with SAM and
# then update each function's code in place with `aws lambda update-function-code`.
#
# This deploys CODE ONLY. It does NOT change infrastructure, env vars, IAM, or
# API Gateway. Env-var changes (e.g. SPOT_COMMISSION_FEE_PCT) must be applied
# separately and carefully — update-function-configuration REPLACES the entire
# env block.
#
# Usage:
#   ./scripts/deploy-backend.sh                  # build + deploy ALL functions
#   ./scripts/deploy-backend.sh api stripe       # deploy a subset (by key)
#   ENVIRONMENT=staging ./scripts/deploy-backend.sh api
#
# Requires: configured AWS credentials, the `sam` CLI, and `zip`.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-dev}"

# Resolve to backend/ regardless of where the script is invoked from.
cd "$(dirname "$0")/.."

# key -> SAM build dir (logical id). Lambda name is spot-<key-name>-<env>.
declare -A BUILD_DIR=(
  [api]="ApiFunction"
  [ai]="AiFunction"
  [stripe]="StripeFunction"
  [sync]="SyncFunction"
  [email]="EmailFunction"
  [lifecycle]="LifecycleFunction"
  [ses-handler]="SESHandlerFunction"
)
declare -A FN_NAME=(
  [api]="spot-api"
  [ai]="spot-ai"
  [stripe]="spot-stripe"
  [sync]="spot-sync"
  [email]="spot-email"
  [lifecycle]="spot-lifecycle"
  [ses-handler]="spot-ses-handler"
)

targets=("$@")
if [ ${#targets[@]} -eq 0 ]; then targets=("${!BUILD_DIR[@]}"); fi

# Validate keys up front.
for key in "${targets[@]}"; do
  if [ -z "${BUILD_DIR[$key]:-}" ]; then
    echo "Unknown function key: '$key'. Valid: ${!BUILD_DIR[*]}" >&2
    exit 1
  fi
done

echo "==> sam build"
sam build >/dev/null

for key in "${targets[@]}"; do
  dir="${BUILD_DIR[$key]}"
  fn="${FN_NAME[$key]}-${ENVIRONMENT}"
  zip="/tmp/${fn}.zip"
  echo "==> packaging ${key} -> ${fn}"
  rm -f "$zip"
  ( cd ".aws-sam/build/${dir}" && zip -qr "$zip" . )
  echo "==> updating ${fn}"
  aws lambda update-function-code \
    --function-name "$fn" \
    --zip-file "fileb://$zip" \
    --region "$REGION" \
    --query 'LastModified' --output text
done

echo "==> done (${#targets[@]} function(s) deployed to '${ENVIRONMENT}')"
