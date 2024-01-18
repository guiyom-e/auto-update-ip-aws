#!/bin/bash
# Outputs parsing inspired from https://gist.github.com/brettswift/f1f0febf18ab89fc9fd43670f8af2937
set -e

SCRIPT_DIR=$(cd $(dirname "$0") && pwd)/domain-auto-update
CDK_DEPLOY_OUTPUT_FILE='.cdk_deploy_result'

rm -rf ${CDK_DEPLOY_OUTPUT_FILE}

# Deploy and collect output in a file, for parsing after
echo "Deploying..."
npx cdk deploy 2>&1 | tee -a ${CDK_DEPLOY_OUTPUT_FILE}

echo "DONE: Stack deployed."

echo "Parsing outputs..."
sed -n -e '/Outputs:/,/^$/ p' ${CDK_DEPLOY_OUTPUT_FILE} >.outputs

FETCH_IP_API_URL=$(awk -F " " '/FetchIpApiUrl/ { print $3 }' .outputs)
UPDATE_IP_SFN_ARN=$(awk -F " " '/UpdateIpSFNArn/ { print $3 }' .outputs)
UPDATE_IP_API_URL=$(awk -F " " '/IntegrationApiUrl/ { print $3 }' .outputs)
API_KEY_RESOURCE_ID=$(awk -F " " '/IntegrationApiKey/ { print $3 }' .outputs)

echo "Saving outputs..."

# GET CURRENT IP API URL
touch $SCRIPT_DIR/get_current_ip_api_url.cfg
chmod 600 $SCRIPT_DIR/get_current_ip_api_url.cfg
echo $FETCH_IP_API_URL >$SCRIPT_DIR/get_current_ip_api_url.cfg
chmod 400 $SCRIPT_DIR/get_current_ip_api_url.cfg

# UPDATE IP SFN ARN
touch $SCRIPT_DIR/update_ip_state_machine_arn.cfg
chmod 600 $SCRIPT_DIR/update_ip_state_machine_arn.cfg
echo $UPDATE_IP_SFN_ARN >$SCRIPT_DIR/update_ip_state_machine_arn.cfg
chmod 400 $SCRIPT_DIR/update_ip_state_machine_arn.cfg
UPDATE_IP_state_machine_arn

# UPDATE IP API URL
touch $SCRIPT_DIR/update_ip_api_url.cfg
chmod 600 $SCRIPT_DIR/update_ip_api_url.cfg
echo $UPDATE_IP_API_URL >$SCRIPT_DIR/update_ip_api_url.cfg
chmod 400 $SCRIPT_DIR/update_ip_api_url.cfg

# API KEY
API_KEY=$(aws apigateway get-api-key --api-key $API_KEY_RESOURCE_ID --include-value | jq -r '.value')

touch $SCRIPT_DIR/api_key.cfg
chmod 600 $SCRIPT_DIR/api_key.cfg
echo $API_KEY >$SCRIPT_DIR/api_key.cfg
chmod 400 $SCRIPT_DIR/api_key.cfg

chmod +x $SCRIPT_DIR/update-ip.sh
chmod +x $SCRIPT_DIR/update-ip-sfn.sh

rm -rf ${CDK_DEPLOY_OUTPUT_FILE}
rm -rf .outputs

echo "DONE: Scripts in 'scripts/domain-auto-update' are ready to use."

read -p "Do you want to add a cron job triggerring the API every morning at 1 am ? (yes/no):" answer

if [[ "$answer" =~ ^[Yy](es)?$ ]]; then
    SCRIPT_PATH="$SCRIPT_DIR/update-ip.sh"
    CRON="0 1 * * * $SCRIPT_PATH"
    crontab -l >user-cron || true

    if [ $(grep -c "$SCRIPT_PATH" user-cron) -ge 1 ]; then
        echo "A cron job already exists for this script: nothing was changed."
        rm user-cron
        exit 0
    fi

    echo "$CRON" >>user-cron
    crontab user-cron
    rm user-cron
else
    exit 0
fi

echo "DONE: Cron job is ready to use."
