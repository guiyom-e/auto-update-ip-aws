#!/bin/bash
set -e

# Option with curl (call to the api gateway integrated with the state machine)
SCRIPT_DIR=$(dirname "$0")
NOW=$(date -Iseconds)

if [ ! -f $SCRIPT_DIR/get_current_ip_api_url.cfg ] || [ ! -f $SCRIPT_DIR/update_ip_api_url.cfg ] || [ ! -f $SCRIPT_DIR/api_key.cfg ]; then
    echo $NOW >$SCRIPT_DIR/latest_error.log &&
        echo "Missing configuration files! Please create the read-only files named 'get_current_ip_api_url.cfg', 'update_ip_api_url.cfg', 'api_key.cfg' and fill them" | tee -a $SCRIPT_DIR/latest_error.log
    exit 2
fi

if [ -w $SCRIPT_DIR/api_key.cfg ] || [ ! $(stat -L -c "%a" $SCRIPT_DIR/api_key.cfg) == "400" ]; then
    echo $NOW >$SCRIPT_DIR/latest_error.log &&
        echo "API key file must be read-only. Run 'chmod 400 api_key.cfg' to do so." | tee -a $SCRIPT_DIR/latest_error.log
    exit 3
fi

GET_CURRENT_IP_API_URL=$(head -n 1 $SCRIPT_DIR/get_current_ip_api_url.cfg)

touch $SCRIPT_DIR/current_ip
OLD_IP=$(tail -n 1 $SCRIPT_DIR/current_ip)

# Get current ip
IP=$(curl -s $GET_CURRENT_IP_API_URL | jq -r .ip)

echo $NOW >$SCRIPT_DIR/latest_script_execution.log
echo "METHOD: api integartion" | tee -a $SCRIPT_DIR/latest_script_execution.log

# Update ip if it has changed since last update (or if it's the first time the script is run)
if [ "$OLD_IP" = "$IP" ]; then
    echo "Already up-to-date!" | tee -a $SCRIPT_DIR/latest_script_execution.log
    exit 0
else
    echo "IP has changed! Updating..."
    echo "Old IP: $OLD_IP / New IP: $IP" | tee -a $SCRIPT_DIR/latest_script_execution.log

    API_KEY=$(head -n 1 $SCRIPT_DIR/api_key.cfg)
    UPDATE_IP_API_URL=$(head -n 1 $SCRIPT_DIR/update_ip_api_url.cfg)

    # Call API to update ip
    STATUS_CODE=$(curl -s -o $SCRIPT_DIR/api-response.log -w "%{http_code}" --header 'Content-Type: application/json' --header "X-API-Key: $API_KEY" --data-raw "{\"ip\":\"$IP\"}" $UPDATE_IP_API_URL)

    if [ "$STATUS_CODE" = "200" ]; then
        echo $NOW >>$SCRIPT_DIR/current_ip
        echo $IP >>$SCRIPT_DIR/current_ip
        echo "Success!" | tee -a $SCRIPT_DIR/latest_script_execution.log
        exit 0
    else
        echo "Error while updating IP!" | tee -a $SCRIPT_DIR/latest_script_execution.log
        cat api-response.log | tee -a $SCRIPT_DIR/latest_script_execution.log
        cp $SCRIPT_DIR/latest_script_execution.log $SCRIPT_DIR/${NOW}_error_log
        exit 4
    fi
fi
