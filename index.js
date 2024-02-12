const express = require('express');
const bodyParser = require('body-parser');
const { PlayFabAdmin, PlayFabServer, PlayFab } = require('playfab-sdk');
const { Web3 } = require('web3'); // Corrected the destructuring for Web3
const fs = require('fs');
const path = require('path');

// Initialize PlayFab configuration
PlayFab.settings.titleId = "D1159";
PlayFab.settings.developerSecretKey = "R3SP6WWQKDOG6POAKENUAGQTSJSFRKN7QBJXH88SUTMJ76OZIF";

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
            const keysDirectory = path.join(__dirname, "keys"); // Define the keys directory path
            if (!fs.existsSync(keysDirectory)) {
                fs.mkdirSync(keysDirectory); // Create the keys directory if it doesn't exist
            }
            const walletFilePath = path.join(keysDirectory, `${userId}.json`); // Adjust the path

            try {
                const walletAddress = await getUserWalletAddress(userId);
                if (!walletAddress) {
                    // Wallet does not exist in PlayFab, create a new one and update PlayFab
                    const newAccount = web3.eth.accounts.create();
                    await updateUserWalletAddress(userId, newAccount.address);
                    // Store only the private key in the JSON file
                    fs.writeFileSync(walletFilePath, JSON.stringify({ privateKey: newAccount.privateKey }, null, 2));
                    console.log(`Wallet created and stored for user ${userId}`);
                    // Update the response to include the newly created wallet address
                    res.send({ message: `Authentication successful, Wallet address for the user: ${newAccount.address}` });
                } else {
                    // Wallet exists, log the private key if the file exists
                    if (fs.existsSync(walletFilePath)) {
                        const walletData = JSON.parse(fs.readFileSync(walletFilePath));
                        console.log(`Private key for user ${userId}: ${walletData.privateKey}`);
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
