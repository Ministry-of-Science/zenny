"use strict";



//  I M P O R T S

import R from "ramda";
import superagent from "superagent";

//  U T I L S

import Block from "../blockchain/block.js";
import Blocks from "../blockchain/blocks.js";
import Transactions from "../blockchain/transactions.js";



//  P R O G R A M

class Node {
  constructor(host, port, peers, blockchain) {
    this.host = host;
    this.port = port;
    this.peers = [];
    this.blockchain = blockchain;
    this.hookBlockchain();
    this.connectToPeers(peers);
  }

  broadcast(fn, ...args) {
    // Call the function for every peer connected
    console.info("Broadcasting");

    this.peers.map(peer => {
      fn.apply(this, [peer, ...args]);
    }, this);
  }

  checkReceivedBlock(block) {
    return this.checkReceivedBlocks([block]);
  }

  checkReceivedBlocks(blocks) {
    const receivedBlocks = blocks.sort((b1, b2) => (b1.index - b2.index));
    const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    const latestBlockHeld = this.blockchain.getLastBlock();

    // If the received blockchain is not longer than blockchain. Do nothing.
    if (latestBlockReceived.index <= latestBlockHeld.index) {
      console.info("Received blockchain is not longer than blockchain. Do nothing");
      return false;
    }

    console.info(`Blockchain possibly behind. We got: ${latestBlockHeld.index}, Peer got: ${latestBlockReceived.index}.`);

    if (latestBlockHeld.hash === latestBlockReceived.previousHash) { // We can append the received block to our chain
      console.info("Appending received block to our chain");
      this.blockchain.addBlock(latestBlockReceived);
      return true;
    } else if (receivedBlocks.length === 1) { // We have to query the chain from our peer
      console.info("Querying chain from our peers");
      this.broadcast(this.getBlocks);
      return null;
    } else { // Received blockchain is longer than current blockchain
      console.info("Received blockchain is longer than current blockchain");
      this.blockchain.replaceChain(receivedBlocks);
      return true;
    }
  }

  connectToPeer(newPeer) {
    this.connectToPeers([newPeer]);
    return newPeer;
  }

  connectToPeers(newPeers) {
    // Connect to every peer
    const me = `http://${this.host}:${this.port}`;

    newPeers.forEach(peer => {
      // If it already has that peer, ignore.
      if (!this.peers.find(element => (element.url === peer.url)) && peer.url !== me) {
        this.sendPeer(peer, { url: me });
        console.info(`Peer ${peer.url} added to connections.`);
        this.peers.push(peer);
        this.initConnection(peer);
        this.broadcast(this.sendPeer, peer);
      } else console.info(`Peer ${peer.url} not added to connections, because I already have.`);
    }, this);
  }

  getBlocks(peer) {
    const URL = `${peer.url}/blockchain/blocks`;
    const self = this;

    console.info(`Getting blocks from: ${URL}`);

    return superagent
      .get(URL)
      .then(res => {
        // Check for what to do with the block list
        self.checkReceivedBlocks(Blocks.fromJson(res.body));
      })
      .catch(err => {
        console.warn(`Unable to get blocks from ${URL}: ${err.message}`);
      });
  }

  getConfirmation(peer, transactionId) {
    // Get if the transaction has been confirmed in that peer
    const URL = `${peer.url}/blockchain/blocks/transactions/${transactionId}`;

    console.info(`Getting transactions from: ${URL}.`);

    return superagent
      .get(URL)
      .then(() => {
        return true;
      })
      .catch(() => {
        return false;
      });
  }

  getConfirmations(transactionId) {
    // Get from all peers if the transaction has been confirmed
    const foundLocally = this.blockchain.getTransactionFromBlocks(transactionId) !== null;

    return Promise.all(R.map(peer => {
      return this.getConfirmation(peer, transactionId);
    }, this.peers))
      .then(values => {
        return R.sum([foundLocally, ...values]);
      });
  }

  getLatestBlock(peer) {
    const URL = `${peer.url}/blockchain/blocks/latest`;
    const self = this;

    console.info(`Getting latest block from: ${URL}`);

    return superagent
      .get(URL)
      .then(res => {
        // Check for what to do with the latest block
        self.checkReceivedBlock(Block.fromJson(res.body));
      })
      .catch(err => {
        console.warn(`Unable to get latest block from ${URL}: ${err.message}`);
      });
  }

  getTransactions(peer) {
    const URL = `${peer.url}/blockchain/transactions`;
    const self = this;

    console.info(`Getting transactions from: ${URL}.`);

    return superagent
      .get(URL)
      .then(res => {
        self.syncTransactions(Transactions.fromJson(res.body));
      })
      .catch(err => {
        console.warn(`Unable to get transations from ${URL}: ${err.message}.`);
      });
  }

  hookBlockchain() {
    // Hook blockchain so it can broadcast blocks or transactions changes
    this.blockchain.emitter.on("blockAdded", block => {
      this.broadcast(this.sendLatestBlock, block);
    });

    this.blockchain.emitter.on("blockchainReplaced", blocks => {
      this.broadcast(this.sendLatestBlock, R.last(blocks));
    });

    this.blockchain.emitter.on("transactionAdded", newTransaction => {
      this.broadcast(this.sendTransaction, newTransaction);
    });
  }

  initConnection(peer) {
    // It initially gets the latest block and all pending transactions
    this.getLatestBlock(peer);
    this.getTransactions(peer);
  }

  sendLatestBlock(peer, block) {
    const URL = `${peer.url}/blockchain/blocks/latest`;

    console.info(`Posting latest block to: ${URL}`);

    return superagent
      .put(URL)
      .send(block)
      .catch(err => {
        console.warn(`Unable to post latest block to ${URL}: ${err.message}`);
      });
  }

  sendPeer(peer, peerToSend) {
    const URL = `${peer.url}/node/peers`;

    console.info(`Sending ${peerToSend.url} to peer ${URL}.`);

    return superagent
      .post(URL)
      .send(peerToSend)
      .catch(err => {
        console.warn(`Unable to send me to peer ${URL}: ${err.message}`);
      });
  }

  sendTransaction(peer, transaction) {
    const URL = `${peer.url}/blockchain/transactions`;

    console.info(`Sending transaction "${transaction.id}" to: "${URL}".`);

    return superagent
      .post(URL)
      .send(transaction)
      .catch(err => {
        console.warn(`Unable to put transaction to ${URL}: ${err.message}.`);
      });
  }

  syncTransactions(transactions) {
    // For each received transaction check if we have it, if not, add.
    R.forEach(transaction => {
      const transactionFound = this.blockchain.getTransactionById(transaction.id);

      if (transactionFound === null) {
        console.info(`Syncing transaction "${transaction.id}".`);
        this.blockchain.addTransaction(transaction);
      }
    }, transactions);
  }
}



//  E X P O R T

export default Node;
