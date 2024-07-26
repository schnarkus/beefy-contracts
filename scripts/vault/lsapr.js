const fetch = require('node-fetch');

async function getAdjustedAPR() {
    try {
        const response = await fetch('https://app.ethena.fi/api/yields/protocol-and-staking-yield');
        const data = await response.json();
        const latestAPR = data.stakingYield.value;
        const lsAprFactor = 1
        const adjustedAPR = (latestAPR * lsAprFactor).toString();
        return adjustedAPR;
    } catch (error) {
        console.error("Error:", error);
    }
}

getAdjustedAPR().then(console.log);