"use strict";



//  I M P O R T

import R from "ramda";

//  U T I L S

import ArgumentError from "../util/argument-error.js";
import Config from "../config.js";
import Db from "../util/db.js";
import Transaction from "../blockchain/transaction.js";
import TransactionBuilder from "./transaction-builder.js";
import Wallet from "./wallet.js";
import Wallets from "./wallets.js";

const OPERATOR_FILE = "wallets.json";



//  P R O G R A M

class Operator {
  constructor(dbName, blockchain) {
    this.db = new Db(`data/${dbName}/${OPERATOR_FILE}`, new Wallets());

    // INFO: In this implementation the database is a file and every time data is
    // saved it rewrites the file, probably it should be a more robust database
    // for performance reasons
    this.wallets = this.db.read(Wallets);
    this.blockchain = blockchain;
  }

  addWallet(wallet) {
    this.wallets.push(wallet);
    this.db.write(this.wallets);
    return wallet;
  }

  checkWalletPassword(walletId, passwordHash) {
    const wallet = this.getWalletById(walletId);

    if (wallet === null)
      throw new ArgumentError(`Wallet not found with id "${walletId}".`);

    return wallet.passwordHash === passwordHash;
  }

  createTransaction(walletId, fromAddressId, toAddressId, amount, changeAddressId) {
    const utxo = this.blockchain.getUnspentTransactionsForAddress(fromAddressId);
    const wallet = this.getWalletById(walletId);

    if (wallet === null)
      throw new ArgumentError(`Wallet not found with id "${walletId}".`);

    const secretKey = wallet.getSecretKeyByAddress(fromAddressId);

    if (secretKey === null)
      throw new ArgumentError(`Secret key not found with Wallet id "${walletId}" and address "${fromAddressId}".`);

    const tx = new TransactionBuilder();

    tx.from(utxo);
    tx.to(toAddressId, amount);
    tx.change(changeAddressId || fromAddressId);
    tx.fee(Config.FEE_PER_TRANSACTION);
    tx.sign(secretKey);

    return Transaction.fromJson(tx.build());
  }

  createWalletFromPassword(password) {
    const newWallet = Wallet.fromPassword(password);
    return this.addWallet(newWallet); // eslint-disable-line padding-line-between-statements
  }

  generateAddressForWallet(walletId) {
    const wallet = this.getWalletById(walletId);

    if (wallet === null)
      throw new ArgumentError(`Wallet not found with id "${walletId}".`);

    const address = wallet.generateAddress();

    this.db.write(this.wallets);
    return address;
  }

  getAddressesForWallet(walletId) {
    const wallet = this.getWalletById(walletId);

    if (wallet === null)
      throw new ArgumentError(`Wallet not found with id "${walletId}".`);

    const addresses = wallet.getAddresses();
    return addresses; // eslint-disable-line padding-line-between-statements
  }

  getBalanceForAddress(addressId) {
    const utxo = this.blockchain.getUnspentTransactionsForAddress(addressId);

    if (utxo === null || utxo.length === 0)
      throw new ArgumentError(`No transactions found for address "${addressId}".`);

    return R.sum(
      R.map(
        R.prop("amount"),
        utxo
      )
    );
  }

  getWalletById(walletId) {
    return R.find(wallet => (wallet.id === walletId), this.wallets);
  }

  getWallets() {
    return this.wallets;
  }
}



//  E X P O R T

export default Operator;
