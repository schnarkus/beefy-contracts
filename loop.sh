#!/bin/bash

while true
do
  yarn hardhat run scripts/vault/withdraw.js --network optimism
  sleep 300  # Sleep for 600 seconds (10 minutes)
done
