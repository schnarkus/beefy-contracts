const fs = require('fs');
const path = require('path');

// Function to update Balancer URLs
function updateBalancerUrls(json) {
    const newBaseUrl = "https://balancer.fi/pools/avalanche/v2/";

    for (let key in json) {
        if (json.hasOwnProperty(key)) {
            if (typeof json[key] === 'object' && json[key] !== null) {
                updateBalancerUrls(json[key]);
            } else if (key === 'addLiquidityUrl' && json[key].includes('balancer.fi')) {
                const poolId = json[key].split('/pool/')[1].split('/add-liquidity')[0];
                json[key] = `${newBaseUrl}${poolId}/add-liquidity`;
            } else if (key === 'removeLiquidityUrl' && json[key].includes('balancer.fi')) {
                const poolId = json[key].split('/pool/')[1].split('/withdraw')[0];
                json[key] = `${newBaseUrl}${poolId}/withdraw`;
            }
        }
    }

    return json;
}

// Read the JSON file from the specified absolute path
const filePath = '/home/schnarkus/beefy/beefy-v2/src/config/vault/avax.json'; // Replace with your actual file path

fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    let json;
    try {
        json = JSON.parse(data);
    } catch (err) {
        console.error('Error parsing JSON:', err);
        return;
    }

    const updatedJson = updateBalancerUrls(json);

    fs.writeFile(filePath, JSON.stringify(updatedJson, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return;
        }

        console.log('File has been updated successfully.');
    });
});
