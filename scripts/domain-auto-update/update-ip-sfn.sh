#!/bin/bash
set -e

# Option with aws cli (direct call to the state machine). aws cli must be installed and configured.
SCRIPT_DIR=$(dirname "$0")
NOW=$(date -Iseconds)

if [ ! -f $SCRIPT_DIR/get_current_ip_api_url.cfg ] || [ ! -f $SCRIPT_DIR/update_ip_state_machine_arn.cfg ]; then
    echo $NOW >$SCRIPT_DIR/latest_error.log &&
        echo "Missing configuration files! Please create the read-only files named 'get_current_ip_api_url.cfg', 'update_ip_state_machine_arn.cfg' and fill them" | tee -a $SCRIPT_DIR/latest_error.log
    exit 2
fi

GET_CURRENT_IP_API_URL=$(head -n 1 $SCRIPT_DIR/get_current_ip_api_url.cfg)

touch $SCRIPT_DIR/current_ip
OLD_IP=$(tail -n 1 $SCRIPT_DIR/current_ip)

# Get current ip
IP=$(curl -s $GET_CURRENT_IP_API_URL | jq -r .ip)
# IP=toto

echo $NOW >$SCRIPT_DIR/latest_script_execution.log
echo "METHOD: aws cli" | tee -a $SCRIPT_DIR/latest_script_execution.log

# Update ip if it has changed since last update (or if it's the first time the script is run)
if [ "$OLD_IP" = "$IP" ]; then
    echo "Already up-to-date!" | tee -a $SCRIPT_DIR/latest_script_execution.log
    exit 0
else
    echo "IP has changed! Updating..."
    echo "Old IP: $OLD_IP / New IP: $IP" | tee -a $SCRIPT_DIR/latest_script_execution.log

    STATE_MACHINE_ARN=$(head -n 1 $SCRIPT_DIR/update_ip_state_machine_arn.cfg)

    # Start the state machine to update ip
    RESPONSE=$(aws stepfunctions start-sync-execution --state-machine-arn $STATE_MACHINE_ARN --input "{ \"request\": { \"ip\": \"$IP\" }, \"sourceIp\": \"$IP\" }")

    if [ $(echo $RESPONSE | jq -r .status) = "SUCCEEDED" ]; then
        echo $NOW >>$SCRIPT_DIR/current_ip
        echo $IP >>$SCRIPT_DIR/current_ip
        echo "Success!" | tee -a $SCRIPT_DIR/latest_script_execution.log
        exit 0
    else
        echo "Error while updating IP!" | tee -a $SCRIPT_DIR/latest_script_execution.log
        echo $RESPONSE | tee -a $SCRIPT_DIR/latest_script_execution.log
        cp $SCRIPT_DIR/latest_script_execution.log $SCRIPT_DIR/${NOW}_error.log
        exit 4
    fi
fi
