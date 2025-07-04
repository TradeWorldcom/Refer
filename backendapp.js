const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const CHAIN_CONFIG = {
    bsc: {
        apiUrl: 'https://api.bscscan.com/api',
        apiKey: 'YOUR_BSCSCAN_API_KEY' // Replace with your actual API key
    },
    eth: {
        apiUrl: 'https://api.etherscan.io/api',
        apiKey: 'YOUR_ETHERSCAN_API_KEY' // Replace with your actual API key
    }
};

// Transaction verification endpoint
app.post('/verify-tx', async (req, res) => {
    const { txid, chain, amount } = req.body;
    
    if (!txid || !chain || !amount) {
        return res.status(400).json({ 
            success: false,
            message: 'Missing required parameters: txid, chain, amount'
        });
    }
    
    const config = CHAIN_CONFIG[chain.toLowerCase()];
    if (!config) {
        return res.status(400).json({ 
            success: false,
            message: 'Unsupported blockchain chain'
        });
    }
    
    try {
        // Verify transaction with blockchain explorer API
        const response = await axios.get(config.apiUrl, {
            params: {
                module: 'proxy',
                action: 'eth_getTransactionByHash',
                txhash: txid,
                apikey: config.apiKey
            }
        });
        
        const txData = response.data.result;
        
        if (!txData) {
            return res.status(400).json({ 
                success: false,
                message: 'Transaction not found'
            });
        }
        
        // Convert value from wei to USDT (assuming USDT has 6 decimals)
        const txValue = parseInt(txData.value) / 1e18;
        
        // Check if transaction value matches the claimed amount
        if (Math.abs(txValue - amount) > 0.1) { // Allow small difference
            return res.status(400).json({ 
                success: false,
                message: 'Transaction amount does not match'
            });
        }
        
        // Check transaction confirmations
        const confirmResponse = await axios.get(config.apiUrl, {
            params: {
                module: 'transaction',
                action: 'gettxreceiptstatus',
                txhash: txid,
                apikey: config.apiKey
            }
        });
        
        const isConfirmed = confirmResponse.data.result.status === '1';
        
        res.json({
            success: true,
            message: 'Transaction verified successfully',
            data: {
                txid,
                amount: txValue,
                from: txData.from,
                to: txData.to,
                confirmed: isConfirmed
            }
        });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error verifying transaction',
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
