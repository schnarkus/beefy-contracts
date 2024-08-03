const fetch = require('node-fetch');

async function getAdjustedAPR() {
    try {
        const response = await fetch('https://api.angle.money/v2/savings?chainId=100');
        const data = await response.json();
        const latestAPR = data.EURA.apy;
        const lsAprFactor = 100
        const adjustedAPR = (latestAPR * lsAprFactor).toString();
        return adjustedAPR;
    } catch (error) {
        console.error("Error:", error);
    }
}

getAdjustedAPR().then(console.log);