const { Connection, VersionedTransaction } = require('@solana/web3.js');
const fetch = require('cross-fetch');
const { Wallet } = require('@project-serum/anchor');


async function executeSwap(userKeypair, outputMint) {
  const rpcUrl = 'https://frosty-maximum-dawn.solana-mainnet.quiknode.pro/5b5a5d932ff429c60633ec8a5239eeeb8fd859eb';
  const connection = new Connection(rpcUrl, 'confirmed');

  
  const inputMint = 'So11111111111111111111111111111111111111112'; 
  const amount = 1000000; 
  const slippageBps = 50; 

  const wallet = new Wallet(userKeypair);


  async function getQuoteAndTransaction() {
    console.log(`[SWAP] Fetching quote for ${amount} SOL -> ${outputMint}`);
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
    const quoteResp = await fetch(quoteUrl);
    const quoteResponse = await quoteResp.json();

    if (!quoteResponse?.routePlan?.length) {
      throw new Error('No swap routes found for the given input/output mint.');
    }

    console.log('[SWAP] Quote received. Requesting transaction...');
    const swapResp = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true
      })
    });
    const swapResponse = await swapResp.json();

    if (swapResponse.error) {
      throw new Error(`Failed to get swap transaction: ${swapResponse.error}`);
    }

    console.log('[SWAP] Transaction fetched successfully.');
    return swapResponse.swapTransaction;
  }

 
  async function submitAndConfirmTransaction(transaction, latestBlockHash) {
    const rawTx = transaction.serialize();
    const txid = await connection.sendRawTransaction(rawTx, {
      skipPreflight: true,
      maxRetries: 2
    });

    console.log(`[SWAP] TX submitted: ${txid}. Confirming...`);
    try {
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: txid
      }, 'confirmed');

      console.log(`[SWAP] TX confirmed: ${txid}`);
      return txid;
    } catch (error) {
      if (error.message.includes('block height exceeded')) {
        console.error('[SWAP] Blockhash expired during confirmation.');
        throw new Error('BLOCKHASH_EXPIRED');
      }
      throw error;
    }
  }

  
  let attempts = 0;
  const MAX_ATTEMPTS = 2;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    console.log(`[SWAP] Attempt ${attempts} of ${MAX_ATTEMPTS}`);

    try {
      console.time(`[SWAP] Attempt ${attempts} Duration`);

    
      const swapTransaction = await getQuoteAndTransaction();

      
      const transactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);

      console.log('[SWAP] Fetching fresh blockhash...');
      const latestBlockHash = await connection.getLatestBlockhash('confirmed');
      transaction.message.recentBlockhash = latestBlockHash.blockhash;

    
      console.log('[SWAP] Signing transaction...');
      transaction.sign([userKeypair]);

     
      const txid = await submitAndConfirmTransaction(transaction, latestBlockHash);

      console.timeEnd(`[SWAP] Attempt ${attempts} Duration`);
      console.log(`[SWAP] Success on attempt ${attempts}. TXID: ${txid}`);
      return txid;

    } catch (error) {
      console.error(`[SWAP] Error during attempt ${attempts}: ${error.message}`);
      if (error.message === 'BLOCKHASH_EXPIRED' && attempts < MAX_ATTEMPTS) {
        console.log('[SWAP] Retrying due to blockhash expiration...');
        continue; 
      }
      throw new Error(`Swap failed after ${attempts} attempts: ${error.message}`);
    }
  }
}

module.exports = executeSwap;
