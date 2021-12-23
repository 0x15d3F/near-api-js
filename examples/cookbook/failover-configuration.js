// Demonstrates how to use failover functionality with provider 
const { providers } = require("near-api-js");

//TODO: replace with placeholders
const MAIN_RPC_SERVER = 'https://rpc.testnet.near.org';
const FAILOVER_RPC_SERVER_1 = 'https://rpc.ci-testnet.near.org';
const FAILOVER_RPC_SERVER_2 = 'https://testnet.rpc.near.dev'; //this one needs API Key

// Provider example
const provider = new providers.JsonRpcProvider({
    url: MAIN_RPC_SERVER,
    /* In case of several unsuccessful calls to the main RPC Server,
    near-api-js will make an attempt to execute call on failover RPC servers. */
    failoverUrls: [FAILOVER_RPC_SERVER_1, FAILOVER_RPC_SERVER_2],
});

async function getNetworkStatus() {
    const result = await provider.status();
    console.log(result);
}

getNetworkStatus();

// Connection example
//TODO⏎