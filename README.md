# PlayMask: Azure PlayFab + Web3 SDK for Next-Gen Gaming Documentation

![playmask-big](https://github.com/andreykobal/playfab-web3/assets/19206978/085dea8f-f478-4329-9633-fd8a689cee1f)


## Introduction

The PlayFab Web3 SDK integrates blockchain functionalities with PlayFab, enabling developers to interact with Ethereum-based smart contracts and manage wallet addresses directly from Unity games and server-side scripts. This SDK is designed to bridge the gap between traditional game development and blockchain technology, offering tools for token management, cryptocurrency transactions, and smart contract deployment.

## Deployements
- **Network**: opBNB
- **Contract**: [0xF9081D0f28A26186153Ce81828Ff86F4A3BCeab0](https://opbnb-testnet.bscscan.com/address/0xF9081D0f28A26186153Ce81828Ff86F4A3BCeab0)

## Structure

The SDK is organized into three main components:

- **Smart Contract Development Environment**: Utilizes Hardhat for compiling, deploying, and testing Ethereum smart contracts.
- **Unity Project**: Integrates PlayFab SDK with Ethereum blockchain functionalities, enabling the management of blockchain-related data and interactions within a Unity game.
- **Express Server** A backend server that is responsible for managing wallets, private keys and calling transactions for users

### Directory Overview

```
.
├── _SmartContract       # Hardhat project for smart contract development
├── _UnityProject        # Unity project with PlayFab and blockchain integration
├── abi.json             # ABI for the deployed smart contract
├── index.js             # Node.js server for handling web3 and PlayFab interactions
├── package-lock.json
├── package.json
└── web3Functions.js     # Utility functions for web3 operations
```

## Getting Started

### Prerequisites

- Node.js and npm installed
- Unity 2019.4 LTS or later
- An Ethereum wallet with some testnet ETH (e.g., Goerli Testnet)
- PlayFab account

### Setup

1. **Smart Contract Setup**: Navigate to the `_SmartContract` directory. Install dependencies with `npm install`. Deploy your smart contract using `npx hardhat run scripts/deploy.js --network goerli`.
2. **Unity Project Setup**: Open the `_UnityProject` directory with Unity. Configure your PlayFab title ID and developer secret key in the PlayFab Editor Extensions.
3. **Server Setup**: In the root directory, install dependencies with `npm install`. Start the server with `node index.js`.

## Features

- **Authentication**: Allow users to log in using email and password or as a guest.
- **Registration**: Enable new users to register by providing an email and password.
- **Remember Me**: Option for users to stay logged in across sessions.
- **Token Transfer**: Facilitate the transfer of tokens between users.
- **Daily Rewards**: Distribute daily rewards to players.
- **Wallet Integration**: Display wallet addresses and token balances for users.


## Usage

### Unity

- Use the provided Unity scripts to authenticate players, manage wallet addresses, and initiate blockchain transactions.

## Node.js Server

- The `index.js` file includes Express routes for handling blockchain operations such as transferring tokens and checking balances.
- Utilize the `web3Functions.js` utility functions for direct blockchain interactions.


### Technologies Used

- **Node.js**: Backend server environment.
- **Express.js**: Web framework for Node.js.
- **PlayFab SDK**: Enables integration with PlayFab services for user authentication and data management.
- **Web3.js**: Library for interacting with Ethereum blockchain.
- **Azure Key Vault**: Securely store private keys.
- **@azure/identity**: Azure Identity SDK for authentication.
- **@azure/keyvault-secrets**: Azure Key Vault Secrets SDK for accessing secrets.



### Endpoints

- **POST /authenticate**: Handles user authentication and wallet management.
- **POST /distributedailyrewards**: Initiates the distribution of daily rewards.
- **POST /transferToken**: Facilitates token transfers between users.


## Setup Instructions

1. Clone the repository.
2. Install dependencies with `npm install`.
3. Configure environment variables by creating a `.env` file. Refer to `.env.example` for required variables.
4. Start the server with `npm start`.

## Code Snippets

### Authenticating Session Ticket

```javascript
app.post('/authenticate', async (req, res) => {
    const sessionTicket = req.body.sessionTicket;
    if (!sessionTicket) {
        return res.status(400).send({ message: 'Session ticket is required' });
    }

    try {
        const userId = await authenticateSessionTicket(sessionTicket);
        await manageWalletAndRespond(userId, res);
    } catch (error) {
        res.status(500).send({ message: "Authentication failed", error });
    }
});
```

This endpoint authenticates the session ticket, retrieves the user's PlayFabId, manages the user's wallet, and responds with the wallet address.

### Distributing Daily Rewards

```javascript
app.post('/distributedailyrewards', async (req, res) => {
    const { sessionTicket } = req.body;

    // Check if sessionTicket was provided in the request
    if (!sessionTicket) {
        return res.status(400).send({ message: 'Session ticket is required' });
    }

    try {
        // Authenticate the session ticket to get the user's PlayFabId
        const userId = await authenticateSessionTicket(sessionTicket);

        // Assume getUserWalletAddress is a function that retrieves the user's wallet address
        // If not existing, it should be implemented based on your application's logic
        const walletAddress = await getUserWalletAddress(userId);

        // Invoke the function to add wallet address and performance score to title data
        // This function will handle checking if the user exists, updating or adding performance score,
        // and distributing daily rewards and updating token balances
        await addWalletAddressAndPerformanceScoreToTitleData(userId, walletAddress);

        // Send a success response
        res.send({ message: "Daily rewards distributed successfully." });
    } catch (error) {
        console.error("An error occurred during daily rewards distribution:", error);
        res.status(500).send({ message: "Failed to distribute daily rewards", error: error.toString() });
    }
});
```

This endpoint distributes daily rewards to users based on their performance scores and updates token balances.

### Token Transfer

```javascript
app.post('/transferToken', async (req, res) => {
    const { recipientUserId, sessionTicket, amount } = req.body;

    if (!sessionTicket || !recipientUserId || !amount) {
        return res.status(400).send({ message: 'Session ticket, recipient user ID, and amount are required' });
    }

    try {

        const senderUserId = await authenticateSessionTicket(sessionTicket);

        // Get sender's wallet address and token balance
        const senderWalletAddress = await getUserWalletAddress(senderUserId);
        const senderPrivateKey = await retrievePrivateKeyFromVault(senderUserId);
        const senderTokenBalance = await getUserTokenBalance(senderUserId);

        if (!senderWalletAddress || !senderPrivateKey) {
            return res.status(404).send({ message: "Sender's wallet address or private key not found" });
        }

        // Convert token balance to a number and compare with the amount to be transferred
        const balance = parseFloat(senderTokenBalance);
        if (isNaN(balance) || balance < amount) {
            return res.status(400).send({ message: "Insufficient token balance" });
        }

        // Get recipient's wallet address
        const recipientWalletAddress = await getUserWalletAddress(recipientUserId);
        if (!recipientWalletAddress) {
            return res.status(404).send({ message: "Recipient's wallet address not found" });
        }

        // Perform the transfer
        await makeSimpleTransfer(recipientWalletAddress, amount, senderPrivateKey);
        //update user balance
        await updateUserBalance({ userId: senderUserId, walletAddress: senderWalletAddress });

        res.send({ message: "Token transfer successful" });
    } catch (e) {
        console.error("Token transfer error:", e);
        res.status(500).send({ message: "Failed to transfer tokens", error: e.toString() });
    }
});
```

This endpoint facilitates token transfers between users, ensuring the sender has sufficient balance and handling the transfer process securely.

## Conclusion

This README provides an overview of the project, setup instructions, and key code snippets for authenticating users, distributing rewards, and transferring tokens. For detailed implementation, refer to the codebase.

## Security

- Private keys are stored securely in Azure Key Vault. Never store private keys in your source code or expose them to the client side.
- Use environment variables to store sensitive information such as PlayFab secrets and Azure credentials.

## Future Plans

<img width="1712" alt="Untitled" src="https://github.com/andreykobal/playfab-web3/assets/19206978/d54edea8-6d89-47d0-be82-8152a21f145b">

Our Future Plans:

- **Tokenization of In-Game Assets**: Introducing NFT minting, dynamic NFTs, fractional ownership, rentals, and crafting for in-game assets.
  
- **DeFi Mechanics in Gaming**: Implementing staking, yield farming, liquidity provision, insurance products, and token burning for rewards within games.
  
- **Play-to-Earn (P2E)**: Offering daily quests, tournaments, micro-rewards, and escrow systems to enable players to earn while playing.
  
- **GameFi and Liquidity Pools**: Establishing in-game liquidity pools, cross-game asset swaps, dynamic yield pools, and token swapping mechanisms.
  
- **Lending and Borrowing**: Facilitating asset lending, collateralized loans, in-game credit scoring, and peer-to-peer lending for in-game assets.
  
- **Social and Community Features**: Introducing social quests, community governance, token-based voting, and blockchain-based achievements.
  
- **Interoperability**: Enabling cross-chain gaming tournaments, asset bridging, cross-chain quests, and multi-blockchain tournaments.
  
- **Marketplace and Trading**: Creating decentralized marketplaces, auction houses, dynamic pricing models, loyalty programs, and automated trading bots.
  
- **Unique Gaming Experiences**: Introducing blockchain-based quests, virtual land ownership, blockchain progression systems, and fully on-chain games.


## Contributing

We welcome contributions and suggestions! Please open issues or pull requests on our GitHub repository for any features, bug fixes, or enhancements.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.

## Acknowledgments

- PlayFab for the comprehensive game development platform.
- Hardhat for the Ethereum development environment.
- Ethereum and Web3.js for enabling blockchain technologies in applications.
