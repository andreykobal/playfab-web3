const express = require('express');
const bodyParser = require('body-parser');
const { PlayFabAdmin, PlayFabServer, PlayFab } = require('playfab-sdk');
const { Web3 } = require('web3'); // Corrected the destructuring for Web3
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

require('dotenv').config(); // This loads the environment variables from the .env file

// Azure Key Vault setup
const keyVaultName = process.env.KEY_VAULT_NAME; // Set this in your environment variables
const keyVaultUrl = `https://${keyVaultName}.vault.azure.net/`;

// Using DefaultAzureCredential assumes the environment is already set up for authentication (e.g., via Azure Managed Identity)
const credential = new DefaultAzureCredential();
const secretClient = new SecretClient(keyVaultUrl, credential);


// Initialize PlayFab configuration
PlayFab.settings.titleId = process.env.PLAYFAB_TITLE_ID;
PlayFab.settings.developerSecretKey = process.env.PLAYFAB_SECRET_KEY;

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Initialize web3 with a provider
const web3 = new Web3('https://ethereum-goerli.publicnode.com');


function updateUserWalletAddress(id, walletAddress) {
    return new Promise((resolve, reject) => {
        const updateDataRequest = {
            PlayFabId: id,
            Data: {
                WalletAddress: walletAddress
            },
            Permission: "Private"
        };

        PlayFabAdmin.UpdateUserReadOnlyData(updateDataRequest, (error, result) => {
            if (error) {
                console.error("Got an error: ", error);
                reject(error);
            } else {
                console.log("Updated user wallet address: ", result);
                resolve(result);
            }
        });
    });
}

function getUserWalletAddress(id) {
    return new Promise((resolve, reject) => {
        const getDataRequest = {
            PlayFabId: id,
            Keys: ["WalletAddress"]
        };

        PlayFabAdmin.GetUserReadOnlyData(getDataRequest, (error, result) => {
            if (error) {
                console.error("Got an error: ", error);
                reject(error);
            } else {
                console.log("Got User Wallet Address from Playfab: ", result);
                const walletAddress = result.data.Data.WalletAddress ? result.data.Data.WalletAddress.Value : null;
                console.log(`Wallet Address for user ${id}: ${walletAddress}`);
                resolve(walletAddress);
            }
        });
    });
}

async function storePrivateKeyInVault(userId, privateKey) {
    await secretClient.setSecret(`PrivateKey-${userId}`, privateKey);
    console.log(`Private key stored in Key Vault for user ${userId}`);
}

async function retrievePrivateKeyFromVault(userId) {
    try {
        const secretBundle = await secretClient.getSecret(`PrivateKey-${userId}`);
        console.log(`Retrieved private key for user ${userId} from Key Vault`);
        return secretBundle.value;
    } catch (e) {
        console.error(`Failed to retrieve private key for user ${userId} from Key Vault`, e);
        return null;
    }
}

app.post('/authenticate', async (req, res) => {
    const sessionTicket = req.body.sessionTicket;

    if (!sessionTicket) {
        return res.status(400).send({ message: 'Session ticket is required' });
    }

    const request = {
        SessionTicket: sessionTicket,
    };

    PlayFabServer.AuthenticateSessionTicket(request, async (error, result) => {
        if (error) {
            console.error("Got an error: ", error);
            res.status(500).send({ message: "Authentication failed", error });
        } else {
            console.log("\x1b[36m%s\x1b[0m", "Got a result: ", result);

            const userId = result.data.UserInfo.PlayFabId;
            try {
                const walletAddress = await getUserWalletAddress(userId);
                if (!walletAddress) {
                    // Wallet does not exist in PlayFab, create a new one and update PlayFab
                    const newAccount = web3.eth.accounts.create();
                    await updateUserWalletAddress(userId, newAccount.address);
                    // Store only the private key in the JSON file
                    await storePrivateKeyInVault(userId, newAccount.privateKey);
                    console.log(`Wallet created and stored for user ${userId}`);
                    // Update the response to include the newly created wallet address
                    res.send({ message: `Authentication successful, Wallet address for the user: ${newAccount.address}` });
                } else {
                    // Wallet exists, log the private key if the file exists
                    const privateKey = await retrievePrivateKeyFromVault(userId);
                    if (privateKey) {
                        console.log(`Private key for user ${userId}: ${privateKey}`);
                    }
                    // Update the response to include the existing wallet address
                    res.send({ message: `Authentication successful, Wallet address for the user: ${walletAddress}` });

                }
            } catch (e) {
                console.error("An error occurred during wallet management: ", e);
                res.status(500).send({ message: "Failed to manage wallet" });
            }
        }
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
