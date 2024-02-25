# PlayMask: PlayFab Web3 SDK Documentation

![playmask](https://github.com/andreykobal/playfab-web3/assets/19206978/e4cc1fb2-bbc6-488a-8bc4-de75f35774ab)


## Introduction

The PlayFab Web3 SDK integrates blockchain functionalities with PlayFab, enabling developers to interact with Ethereum-based smart contracts and manage wallet addresses directly from Unity games and server-side scripts. This SDK is designed to bridge the gap between traditional game development and blockchain technology, offering tools for token management, cryptocurrency transactions, and smart contract deployment.

## Structure

The SDK is organized into two main components:

- **Smart Contract Development Environment**: Utilizes Hardhat for compiling, deploying, and testing Ethereum smart contracts.
- **Unity Project**: Integrates PlayFab SDK with Ethereum blockchain functionalities, enabling the management of blockchain-related data and interactions within a Unity game.

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

### Node.js Server

- The `index.js` file includes Express routes for handling blockchain operations such as transferring tokens and checking balances.
- Utilize the `web3Functions.js` utility functions for direct blockchain interactions.

## Security

- Private keys are stored securely in Azure Key Vault. Never store private keys in your source code or expose them to the client side.
- Use environment variables to store sensitive information such as PlayFab secrets and Azure credentials.

## Contributing

We welcome contributions and suggestions! Please open issues or pull requests on our GitHub repository for any features, bug fixes, or enhancements.

## License

This project is licensed under the MIT License - see the `LICENSE` file in the `_SmartContract` directory for details.

## Acknowledgments

- PlayFab for the comprehensive game development platform.
- Hardhat for the Ethereum development environment.
- Ethereum and Web3.js for enabling blockchain technologies in applications.
