const express = require('express');
const bodyParser = require('body-parser');
const { PlayFab, PlayFabAdmin, PlayFabServer } = require('playfab-sdk');
const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');

// Initialize PlayFab configuration
PlayFab.settings.titleId = "D1159";
PlayFab.settings.developerSecretKey = "R3SP6WWQKDOG6POAKENUAGQTSJSFRKN7QBJXH88SUTMJ76OZIF";

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Initialize web3 with a provider (this can be an Infura URL, or any other Ethereum node URL)
const web3 = new Web3('https://ethereum-goerli.publicnode.com'); // Adjust the provider URL accordingly



function updateUserWalletAddress(id ,walletAddress) {
    const updateDataRequest = {
        PlayFabId: id,
        Data: {
            WalletAddress: walletAddress
        },
        IfChangedFromDataVersion: 0,
        Permission: "Private"
    };

    PlayFabAdmin.UpdateUserReadOnlyData(updateDataRequest, (error, result) => {
        if (error) {
            console.error("Got an error: ", error);
        } else {
            console.log("Updated user wallet address: ", result);
        }
    });
}

function getUserWalletAddress(id) {
    const getDataRequest = {
        PlayFabId: id,
        Keys: ["WalletAddress"]
    };

    PlayFabAdmin.GetUserReadOnlyData(getDataRequest, (error, result) => {
        if (error) {
            console.error("Got an error: ", error);
        } else {
            console.log("Got User Wallet Address from Playfab: ", result);
            // Accessing the WalletAddress object
            const walletAddress = result.data.Data.WalletAddress ? result.data.Data.WalletAddress.Value : 'No Wallet Address Found';
            console.log(`Wallet Address for user ${id}: ${walletAddress}`);
        }
    });
}



app.post('/authenticate', (req, res) => {
    const sessionTicket = req.body.sessionTicket;

    if (!sessionTicket) {
        return res.status(400).send({ message: 'Session ticket is required' });
    }

    const request = {
        SessionTicket: sessionTicket,
    };

    PlayFabServer.AuthenticateSessionTicket(request, (error, result) => {
        if (error) {
            console.error("Got an error: ", error);
            res.status(500).send({ message: "Authentication failed", error });
        } else {
            console.log("\x1b[36m%s\x1b[0m", "Got a result: ", result);

            const userId = result.data.UserInfo.PlayFabId;
            const walletFilePath = path.join(__dirname, `${userId}.json`);

            // Check if the wallet file already exists
            if (!fs.existsSync(walletFilePath)) {
                // Create a new blockchain wallet
                const newAccount = web3.eth.accounts.create();

                // Prepare the wallet data
                const walletData = {
                    address: newAccount.address,
                    privateKey: newAccount.privateKey
                };

                // Write the wallet data to a JSON file
                fs.writeFileSync(walletFilePath, JSON.stringify(walletData, null, 2));

                console.log(`Wallet created for user ${userId}`);

                // Update the user's wallet address in PlayFab
                updateUserWalletAddress(userId, walletData.address);
            } else {
                console.log(`Wallet already exists for user ${userId}`);
                getUserWalletAddress(userId);
            }

            res.send({ message: "Authentication successful" });
        }
    });

});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
