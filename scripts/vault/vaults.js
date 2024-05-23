const fs = require('fs');

// Path to the JSON file
const filePath = '/home/schnarkus/beefy/beefy-v2/src/config/vault/polygon.json';

// Read JSON data from file
fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading the file:', err);
        return;
    }

    // Parse the JSON data
    const vaults = JSON.parse(data);

    // Filter vaults without an updatedAt timestamp, platformId gamma, tokenProviderId quickswap, and status active
    const filteredVaults = vaults.filter(vault =>
        !vault.updatedAt && vault.platformId === 'gamma' && vault.tokenProviderId === 'quickswap' && vault.status === 'active'
    );

    // Extract vault IDs
    const vaultIds = filteredVaults.map(vault => vault.id);

    // Write vault IDs to a text file
    const textFilePath = './vaults.txt';
    fs.writeFile(textFilePath, vaultIds.join('\n'), 'utf8', err => {
        if (err) {
            console.error('Error writing the file:', err);
            return;
        }

        console.log('Vault IDs written to vaultIds.txt successfully!');
    });
});
