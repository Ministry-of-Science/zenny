"use strict";



//  I M P O R T

import R from "ramda";

//  U T I L S

import Config from "../config.js";
import CryptoUtil from "../util/crypto-util.js";
import Transactions from "./transactions.js";



//  P R O G R A M

class Block {
  static fromJson(data) {
    const block = new Block();

    R.forEachObjIndexed((value, key) => {
      if (key === "transactions" && value)
        block[key] = Transactions.fromJson(value);
      else
        block[key] = value;
    }, data);

    block.hash = block.toHash();
    return block;
  }

  static get genesis() {
    // The genesis block is fixed
    return Block.fromJson(Config.genesisBlock);
  }

  getDifficulty() {
    // 14 is the maximum precision length supported by JavaScript
    return parseInt(this.hash.substring(0, 14), 16);
  }

  toHash() {
    // INFO: There are different implementations of the hash algorithm, for example: https://en.bitcoin.it/wiki/Hashcash
    return CryptoUtil.hash(
      this.index +
      this.previousHash +
      this.timestamp +
      JSON.stringify(this.transactions) +
      this.nonce
    );
  }
}



//  E X P O R T

export default Block;



// { // Block
//   "hash": "c4e0b8df46...199754d1ed", // hash taken from the contents of the block: sha256 (index + previousHash + timestamp + nonce + transactions) (64 bytes)
//   "index": 0, // (first block: 0)
//   "nonce": 0, // nonce used to identify the proof-of-work step.
//   "previousHash": "0", // (hash of previous block, first block is 0) (64 bytes)
//   "timestamp": 1465154705, // number of seconds since January 1, 1970
//   "transactions": [ // list of transactions inside the block
//     { // transaction 0
//       "data": {
//         "inputs": [], // list of input transactions
//         "outputs": [] // list of output transactions
//       },
//       "hash": "563b8aa350...3eecfbd26b", // hash taken from the contents of the transaction: sha256 (id + data) (64 bytes)
//       "id": "63ec3ac02f...8d5ebc6dba", // random id (64 bytes)
//       "type": "regular" // transaction type (regular, fee, reward)
//     }
//   ]
// }
