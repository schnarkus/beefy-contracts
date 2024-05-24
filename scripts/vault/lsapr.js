const fetch = require('node-fetch');

async function getAdjustedAPR() {
    try {
        const response = await fetch('https://www.etherfi.bid/api/etherfi/apr');
        const data = await response.json();
        const latestAPR = data.latest_aprs[0];
        const lsAprFactor = 0.01;
        const adjustedAPR = (latestAPR * lsAprFactor).toString();
        return adjustedAPR;
    } catch (error) {
        console.error("Error:", error);
    }
}

getAdjustedAPR().then(console.log);