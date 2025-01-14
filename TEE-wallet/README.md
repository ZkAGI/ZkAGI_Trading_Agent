# TEE-Enhanced Solana Wallet Management and Swaps

This project implements a Telegram bot to manage Solana wallets and execute token swaps securely. The bot leverages **Trusted Execution Environment (TEE)** for securely generating and using private keys during swap operations.

---

## Key Features

1. **Wallet Management**:
   - Users can generate a Solana wallet by providing a password (PIN).
   - The wallet's private key is encrypted using AES-256 encryption with the user-provided PIN.
   - Private keys are decrypted only inside a TEE container during swap execution.

2. **Two-Factor Authentication (2FA)**:
   - A TOTP-based (Time-based One-Time Password) authentication is implemented for additional security.
   - 2FA setup involves generating a secret key that the user scans via a QR code in an authenticator app (e.g., Google Authenticator).
   - Users must provide a valid 2FA code to authorize swap operations.

3. **TEE-Based Swap Execution**:
   - Swap operations are performed inside a TEE container to ensure that private keys are never exposed to the host environment.
   - Transactions, including private key decryption, signing, and broadcasting, are securely handled within the TEE.

4. **Parallel User Support**:
   - The bot can handle multiple users and requests simultaneously without blocking operations.

---

## Requirements

1. **Node.js**: Version 14 or higher.

2. **Solana RPC Endpoint**: Use a reliable endpoint (e.g., QuickNode, Alchemy).
3. **TEE Environment**: A machine or cloud service capable of running TEE containers.

---

## Installation and Usage

1. **Run**:
   ```bash
   node server.js
