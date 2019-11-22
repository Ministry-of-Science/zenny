"use strict";



//  P A C K A G E S

const R = require("ramda");
const spawn = require("threads").spawn;

//  U T I L S

const Block = require("../blockchain/block");
const Config = require("../config");
const CryptoUtil = require("../util/crypto-ttil");
const Transaction = require("../blockchain/transaction");



//  P R O G R A M

class Miner {
  constructor(blockchain, logLevel) {
    this.blockchain = blockchain;
    this.logLevel = logLevel;
  }

  static generateNextBlock(rewardAddress, feeAddress, blockchain) {
    const blocks = blockchain.getAllBlocks();
    const candidateTransactions = blockchain.transactions;
    const previousBlock = blockchain.getLastBlock();
    const index = previousBlock.index + 1;
    const previousHash = previousBlock.hash;
    const timestamp = new Date().getTime() / 1000;

    const transactionsInBlocks = R.flatten(
      R.map(
        R.prop("transactions"),
        blocks
      )
    );

    const inputTransactionsInTransaction = R.compose(
      R.flatten,
      R.map(
        R.compose(
          R.prop("inputs"),
          R.prop("data")
        )
      )
    );

    // Select transactions that can be mined
    const rejectedTransactions = [];
    const selectedTransactions = [];

    R.forEach(transaction => {
      const outputsLen = transaction.data.outputs.length;
      let i = 0;
      let negativeOutputsFound = 0;

      // Check for negative outputs (avoiding negative transactions or "stealing")
      for (i = 0; i < outputsLen; i++) {
        if (transaction.data.outputs[i].amount < 0)
          negativeOutputsFound++;
      }

      // Check if any of the inputs is found in the selectedTransactions or in the blockchain
      const transactionInputFoundAnywhere = R.map((input) => {
        const findInputTransactionInTransactionList = R.find(
          R.whereEq({
            index: input.index,
            transaction: input.transaction
          }));

        // Find the candidate transaction in the selected transaction list (avoiding double spending)
        const wasItFoundInSelectedTransactions = R.not(
          R.isNil(
            findInputTransactionInTransactionList(
              inputTransactionsInTransaction(selectedTransactions)
            )
          )
        );

        // Find the candidate transaction in the blockchain (avoiding mining invalid transactions)
        const wasItFoundInBlocks = R.not(
          R.isNil(
            findInputTransactionInTransactionList(
              inputTransactionsInTransaction(transactionsInBlocks)
            )
          )
        );

        return wasItFoundInSelectedTransactions || wasItFoundInBlocks;
      }, transaction.data.inputs);

      if (R.all(R.equals(false), transactionInputFoundAnywhere)) {
        if (transaction.type === "regular" && negativeOutputsFound === 0)
          selectedTransactions.push(transaction);
        else if (transaction.type === "reward")
          selectedTransactions.push(transaction);
        else if (negativeOutputsFound > 0)
          rejectedTransactions.push(transaction);
      } else
        rejectedTransactions.push(transaction);
    }, candidateTransactions);

    console.info(`Selected ${selectedTransactions.length} candidate transactions with ${rejectedTransactions.length} being rejected.`);

    // Get the first two avaliable transactions, if there are no TRANSACTIONS_PER_BLOCK, it is empty
    const transactions = R.defaultTo([], R.take(Config.TRANSACTIONS_PER_BLOCK, selectedTransactions));

    // Add fee transaction (1 satoshi per transaction)
    if (transactions.length > 0) {
      const feeTransaction = Transaction.fromJson({
        data: {
          inputs: [],
          outputs: [
            {
              address: feeAddress, // INFO: Usually here is a locking script (to check who and when this transaction output can be used), in this case it's a simple destination address
              amount: Config.FEE_PER_TRANSACTION * transactions.length // satoshis format
            }
          ]
        },
        hash: null,
        id: CryptoUtil.randomId(64),
        type: "fee"
      });

      transactions.push(feeTransaction);
    }

    // Add reward transaction of 50 coins
    if (rewardAddress !== null) {
      const rewardTransaction = Transaction.fromJson({
        data: {
          inputs: [],
          outputs: [
            {
              address: rewardAddress, // INFO: Usually here is a locking script (to check who and when this transaction output can be used), in this case it's a simple destination address
              amount: Config.MINING_REWARD // satoshis format
            }
          ]
        },
        hash: null,
        id: CryptoUtil.randomId(64),
        type: "reward"
      });

      transactions.push(rewardTransaction);
    }

    return Block.fromJson({
      index,
      nonce: 0,
      previousHash,
      timestamp,
      transactions
    });
  }

  static proveWorkFor(jsonBlock, difficulty) {
    const block = Block.fromJson(jsonBlock);
    const start = process.hrtime();
    let blockDifficulty = null;

    // INFO: Every cryptocurrency has a different way to prove work, this is a simple hash sequence
    // Loop incrementing the nonce to find the hash at desired difficulty
    do {
      block.timestamp = new Date().getTime() / 1000;
      block.nonce++;
      block.hash = block.toHash();
      blockDifficulty = block.getDifficulty();
    } while(blockDifficulty >= difficulty);
    console.info(`Block found: time "${process.hrtime(start)[0]} sec" dif "${difficulty}" hash "${block.hash}" nonce "${block.nonce}"`);
    return block;
  }

  mine(rewardAddress, feeAddress) {
    const baseBlock = Miner.generateNextBlock(rewardAddress, feeAddress, this.blockchain);

    process.execArgv = R.reject((item) => item.includes("debug"), process.execArgv);

    const thread = spawn((input, done) => {
      require(input.__dirname + "/../util/console-wrapper.js")("mine-worker", input.logLevel);
      const Block = require(input.__dirname + "/../blockchain/block");
      const Miner = require(input.__dirname);

      done(Miner.proveWorkFor(Block.fromJson(input.jsonBlock), input.difficulty));
    });

    const transactionList = R.pipe(
      R.countBy(R.prop("type")),
      R.toString,
      R.replace("{", ""),
      R.replace("}", ""),
      R.replace(/"/g, "")
    )(baseBlock.transactions);

    console.info(`Mining a new block with ${baseBlock.transactions.length} (${transactionList}) transactions.`);

    const promise = thread.promise().then(result => {
      thread.kill();
      return result;
    });

    thread.send({
      difficulty: this.blockchain.getDifficulty(),
      __dirname,
      jsonBlock: baseBlock,
      logLevel: this.logLevel
    });

    return promise;
  }
}



//  E X P O R T

module.exports = exports = Miner;
