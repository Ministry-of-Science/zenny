"use strict";



//  N A T I V E

const EventEmitter = require("events");

//  P A C K A G E

const R = require("ramda");

//  U T I L S

const Block = require("./block");
const BlockAssertionError = require("./block-assertion-error");
const BlockchainAssertionError = require("./blockchain-assertion-error");
const Blocks = require("./blocks");
const Config = require("../config");
const Db = require("../util/db");
const Transactions = require("./transactions");
const TransactionAssertionError = require("./transaction-assertion-error");

// Database settings
const BLOCKCHAIN_FILE = "blocks.json";
const TRANSACTIONS_FILE = "transactions.json";



//  P R O G R A M

class Blockchain {
  constructor(dbName) {
    this.blocksDb = new Db(`data/${dbName}/${BLOCKCHAIN_FILE}`, new Blocks());
    this.transactionsDb = new Db(`data/${dbName}/${TRANSACTIONS_FILE}`, new Transactions());

    // INFO: In this implementation the database is a file and every time data
    // is saved it rewrites the file, probably it should be a more robust database
    // for performance reasons
    this.blocks = this.blocksDb.read(Blocks);
    this.transactions = this.transactionsDb.read(Transactions);

    // Some places uses the emitter to act after some data is changed
    this.emitter = new EventEmitter();
    this.init();
  }

  init() {
    // Create the genesis block if the blockchain is empty
    if (this.blocks.length === 0) {
      console.info("Blockchain empty, adding genesis block");

      this.blocks.push(Block.genesis);
      this.blocksDb.write(this.blocks);
    }

    // Remove transactions that are in the blockchain
    console.info("Removing transactions that are in the blockchain");
    R.forEach(this.removeBlockTransactionsFromTransactions.bind(this), this.blocks);
  }

  getAllBlocks() {
    return this.blocks;
  }

  getBlockByIndex(index) {
    return R.find(R.propEq("index", index), this.blocks);
  }

  getBlockByHash(hash) {
    return R.find(R.propEq("hash", hash), this.blocks);
  }

  getLastBlock() {
    return R.last(this.blocks);
  }

  getDifficulty(index) {
    // Calculates the difficulty based on the index since the difficulty value increases every X blocks.
    return Config.pow.getDifficulty(this.blocks, index);
  }

  getAllTransactions() {
    return this.transactions;
  }

  getTransactionById(id) {
    return R.find(R.propEq("id", id), this.transactions);
  }

  getTransactionFromBlocks(transactionId) {
    return R.find(
      R.compose(
        R.find(
          R.propEq("id", transactionId)
        ),
        R.prop("transactions")
      ),
      this.blocks
    );
  }

  replaceChain(newBlockchain) {
    // It does not make sense to replace this blockchain by a smaller one
    if (newBlockchain.length <= this.blocks.length) {
      console.error("Blockchain shorter than the current blockchain.");
      throw new BlockchainAssertionError("Blockchain shorter than the current blockchain.");
    }

    // Verify if the new blockchain is correct
    this.checkChain(newBlockchain);

    // Get the blocks that diverges from our blockchain
    console.info("Received blockchain is valid. Replacing current blockchain with received blockchain.");
    const newBlocks = R.takeLast(newBlockchain.length - this.blocks.length, newBlockchain);

    // Add each new block to the blockchain
    R.forEach(block => {
      this.addBlock(block, false);
    }, newBlocks);

    this.emitter.emit("blockchainReplaced", newBlocks);
  }

  checkChain(blockchainToValidate) {
    // Check if the genesis block is the same
    if (JSON.stringify(blockchainToValidate[0]) !== JSON.stringify(Block.genesis)) {
      console.error("Genesis blocks are not the same.");
      throw new BlockchainAssertionError("Genesis blocks are not the same.");
    }

    // Compare every block to the previous one (it skips the first one, because it was verified before)
    try {
      for (let i = 1; i < blockchainToValidate.length; i++)
        this.checkBlock(blockchainToValidate[i], blockchainToValidate[i - 1], blockchainToValidate);
    } catch(ex) {
      console.error("Invalid block sequence");
      throw new BlockchainAssertionError("Invalid block sequence.", null, ex);
    }

    return true;
  }

  addBlock(newBlock, emit = true) {
    // It only adds the block if it is valid (we need to compare to the previous one)
    if (this.checkBlock(newBlock, this.getLastBlock())) {
      this.blocks.push(newBlock);
      this.blocksDb.write(this.blocks);

      // After adding the block it removes the transactions of this block from the list of pending transactions
      this.removeBlockTransactionsFromTransactions(newBlock);

      console.info(`Block added: ${newBlock.hash}`);
      console.debug(`Block added: ${JSON.stringify(newBlock)}`);

      if (emit)
        this.emitter.emit("blockAdded", newBlock);

      return newBlock;
    }
  }

  addTransaction(newTransaction, emit = true) {
    // It only adds the transaction if it's valid
    if (this.checkTransaction(newTransaction, this.blocks)) {
      this.transactions.push(newTransaction);
      this.transactionsDb.write(this.transactions);

      console.info(`Transaction added: ${newTransaction.id}`);
      console.debug(`Transaction added: ${JSON.stringify(newTransaction)}`);

      if (emit)
        this.emitter.emit("transactionAdded", newTransaction);

      return newTransaction;
    }
  }

  removeBlockTransactionsFromTransactions(newBlock) {
    this.transactions = R.reject(transaction => {
      return R.find(
        R.propEq("id", transaction.id),
        newBlock.transactions
      );
    }, this.transactions);

    this.transactionsDb.write(this.transactions);
  }

  checkBlock(newBlock, previousBlock, referenceBlockchain = this.blocks) {
    const blockHash = newBlock.toHash();

    if (previousBlock.index + 1 !== newBlock.index) { // Check if the block is the last one
      console.error(`Invalid index: expected "${previousBlock.index + 1}" got "${newBlock.index}"`);
      throw new BlockAssertionError(`Invalid index: expected "${previousBlock.index + 1}" got "${newBlock.index}"`);
    } else if (previousBlock.hash !== newBlock.previousHash) { // Check if the previous block is correct
      console.error(`Invalid previoushash: expected "${previousBlock.hash}" got "${newBlock.previousHash}"`);
      throw new BlockAssertionError(`Invalid previoushash: expected "${previousBlock.hash}" got "${newBlock.previousHash}"`);
    } else if (blockHash !== newBlock.hash) { // Check if the hash is correct
      console.error(`Invalid hash: expected "${blockHash}" got "${newBlock.hash}"`);
      throw new BlockAssertionError(`Invalid hash: expected "${blockHash}" got "${newBlock.hash}"`);
    } else if (newBlock.getDifficulty() >= this.getDifficulty(newBlock.index)) { // If the difficulty level of the proof-of-work challenge is correct
      console.error(`Invalid proof-of-work difficulty: expected "${newBlock.getDifficulty()}" to be smaller than "${this.getDifficulty(newBlock.index)}"`);
      throw new BlockAssertionError(`Invalid proof-of-work difficulty: expected "${newBlock.getDifficulty()}" be smaller than "${this.getDifficulty()}"`);
    }

    // INFO: Here it would need to check if the block follows some
    // expectation regarging the minimal number of transactions,
    // value or data size to avoid empty blocks being mined.

    // For each transaction in this block, check if it is valid
    R.forEach(this.checkTransaction.bind(this), newBlock.transactions, referenceBlockchain);

    // Check if the sum of output transactions are equal the sum of input
    // transactions + MINING_REWARD (representing the reward for the block miner)
    const sumOfInputsAmount = R.sum(
      R.flatten(
        R.map(
          R.compose(
            R.map(R.prop("amount")),
            R.prop("inputs"),
            R.prop("data")
          ),
          newBlock.transactions
        )
      )
    ) + Config.MINING_REWARD;

    const sumOfOutputsAmount = R.sum(
      R.flatten(
        R.map(
          R.compose(
            R.map(R.prop("amount")),
            R.prop("outputs"),
            R.prop("data")
          ),
          newBlock.transactions
        )
      )
    );

    const isInputsAmountGreaterOrEqualThanOutputsAmount = R.gte(sumOfInputsAmount, sumOfOutputsAmount);

    if (!isInputsAmountGreaterOrEqualThanOutputsAmount) {
      console.error(`Invalid block balance: inputs sum "${sumOfInputsAmount}", outputs sum "${sumOfOutputsAmount}"`);

      throw new BlockAssertionError(
        `Invalid block balance: inputs sum "${sumOfInputsAmount}", outputs sum "${sumOfOutputsAmount}"`, {
          sumOfInputsAmount,
          sumOfOutputsAmount
        }
      );
    }

    // Check if there is double spending
    const listOfTransactionIndexInputs = R.flatten(
      R.map(
        R.compose(
          R.map(
            R.compose(
              R.join("|"),
              R.props(["transaction", "index"])
            )
          ),
          R.prop("inputs"),
          R.prop("data")
        ),
        newBlock.transactions
      )
    );

    const doubleSpendingList = R.filter(
      x => x >= 2,
      R.map(
        R.length,
        R.groupBy(x => x)(listOfTransactionIndexInputs)
      )
    );

    if (R.keys(doubleSpendingList).length) {
      console.error(`There are unspent output transactions being used more than once: unspent output transaction: "${R.keys(doubleSpendingList).join(", ")}"`);

      throw new BlockAssertionError(
        `There are unspent output transactions being used more than once: unspent output transaction: "${R.keys(doubleSpendingList).join(", ")}"`
      );
    }

    // Check if there is only 1 fee transaction and 1 reward transaction;
    const transactionsByType = R.countBy(R.prop("type"), newBlock.transactions);

    if (transactionsByType.fee && transactionsByType.fee > 1) {
      console.error(`Invalid fee transaction count: expected "1" got "${transactionsByType.fee}"`);
      throw new BlockAssertionError(`Invalid fee transaction count: expected "1" got "${transactionsByType.fee}"`);
    }

    if (transactionsByType.reward && transactionsByType.reward > 1) {
      console.error(`Invalid reward transaction count: expected "1" got "${transactionsByType.reward}"`);
      throw new BlockAssertionError(`Invalid reward transaction count: expected "1" got "${transactionsByType.reward}"`);
    }

    return true;
  }

  checkTransaction(transaction, referenceBlockchain = this.blocks) {
    // Check the transaction
    transaction.check(transaction);

    // Verify if the transaction is not already in the blockchain
    const isNotInBlockchain = R.all((block) => {
      return R.none(
        R.propEq("id", transaction.id),
        block.transactions
      );
    }, referenceBlockchain);

    if (!isNotInBlockchain) {
      console.error(`Transaction "${transaction.id}" is already in the blockchain`);
      throw new TransactionAssertionError(`Transaction "${transaction.id}" is already in the blockchain`, transaction);
    }

    // Verify if all input transactions are unspent in the blockchain
    const isInputTransactionsUnspent = R.all(
      R.equals(false),
      R.flatten(
        R.map(txInput => {
          return R.map(
            R.pipe(
              R.prop("transactions"),
              R.map(R.pipe(
                R.path(["data", "inputs"]),
                R.contains({
                  index: txInput.index,
                  transaction: txInput.transaction
                })
              ))
            ),
            referenceBlockchain
          );
        }, transaction.data.inputs)
      )
    );

    if (!isInputTransactionsUnspent) {
      console.error(`Not all inputs are unspent for transaction "${transaction.id}"`);
      throw new TransactionAssertionError(`Not all inputs are unspent for transaction "${transaction.id}"`, transaction.data.inputs);
    }

    return true;
  }

  getUnspentTransactionsForAddress(address) {
    const selectTxs = transaction => {
      let index = 0;

      // Create a list of all transactions outputs found for an address (or all).
      R.forEach(txOutput => {
        if (address && txOutput.address === address) {
          txOutputs.push({
            address: txOutput.address,
            amount: txOutput.amount,
            index: index,
            transaction: transaction.id
          });
        }

        index++;
      }, transaction.data.outputs);

      // Create a list of all transactions inputs found for an address (or all).
      R.forEach(txInput => {
        if (address && txInput.address !== address)
          return;

        txInputs.push({
          address: txInput.address,
          amount: txInput.amount,
          index: txInput.index,
          transaction: txInput.transaction
        });
      }, transaction.data.inputs);
    };

    // Considers both transactions in block and unconfirmed transactions (enabling transaction chain)
    const txOutputs = [];
    const txInputs = [];

    R.forEach(
      R.pipe(
        R.prop("transactions"),
        R.forEach(selectTxs)
      ),
      this.blocks
    );

    R.forEach(selectTxs, this.transactions);

    // Cross both lists and find transactions outputs without a corresponding transaction input
    const unspentTransactionOutput = [];

    R.forEach(txOutput => {
      if (
        !R.any(txInput => txInput.transaction === txOutput.transaction && txInput.index === txOutput.index, txInputs)
      ) unspentTransactionOutput.push(txOutput);
    }, txOutputs);

    return unspentTransactionOutput;
  }
}



//  E X P O R T

module.exports = exports = Blockchain;
