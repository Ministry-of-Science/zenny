const R = require("ramda");
const Wallets = require("./wallets");
const Wallet = require("./wallet");
const Transaction = require("../blockchain/transaction");
const TransactionBuilder = require("./transaction-builder");
const Db = require("../util/db");
const ArgumentError = require("../util/argument-error");
const Config = require("../config");

const OPERATOR_FILE = "wallets.json";

class Operator {
  constructor(dbName, blockchain) {
    this.db = new Db("data/" + dbName + "/" + OPERATOR_FILE, new Wallets());

    // INFO: In this implementation the database is a file and every time data is saved it rewrites the file, probably it should be a more robust database for performance reasons
    this.wallets = this.db.read(Wallets);
    this.blockchain = blockchain;
  }

  addWallet(wallet) {
    this.wallets.push(wallet);
    this.db.write(this.wallets);
    return wallet;
  }

  createWalletFromPassword(password) {
    const newWallet = Wallet.fromPassword(password);

    return this.addWallet(newWallet);
  }

  checkWalletPassword(walletId, passwordHash) {
    const wallet = this.getWalletById(walletId);

    if (wallet === null)
      throw new ArgumentError(`Wallet not found with id '${walletId}'`);

    return wallet.passwordHash === passwordHash;
  }

  getWallets() {
    return this.wallets;
  }

  getWalletById(walletId) {
    return R.find(wallet => (wallet.id === walletId), this.wallets);
  }

  generateAddressForWallet(walletId) {
    const wallet = this.getWalletById(walletId);

    if (wallet === null)
      throw new ArgumentError(`Wallet not found with id '${walletId}'`);

    const address = wallet.generateAddress();

    this.db.write(this.wallets);
    return address;
  }

  getAddressesForWallet(walletId) {
    const wallet = this.getWalletById(walletId);

    if (wallet === null)
      throw new ArgumentError(`Wallet not found with id '${walletId}'`);

    const addresses = wallet.getAddresses();

    return addresses;
  }

  getBalanceForAddress(addressId) {
    const utxo = this.blockchain.getUnspentTransactionsForAddress(addressId);

    if (utxo === null || utxo.length === 0)
      throw new ArgumentError(`No transactions found for address '${addressId}'`);

    return R.sum(
      R.map(
        R.prop("amount"),
        utxo
      )
    );
  }

  createTransaction(walletId, fromAddressId, toAddressId, amount, changeAddressId) {
    const utxo = this.blockchain.getUnspentTransactionsForAddress(fromAddressId);
    const wallet = this.getWalletById(walletId);

    if (wallet === null)
      throw new ArgumentError(`Wallet not found with id '${walletId}'`);

    const secretKey = wallet.getSecretKeyByAddress(fromAddressId);

    if (secretKey === null)
      throw new ArgumentError(`Secret key not found with Wallet id '${walletId}' and address '${fromAddressId}'`);

    const tx = new TransactionBuilder();

    tx.from(utxo);
    tx.to(toAddressId, amount);
    tx.change(changeAddressId || fromAddressId);
    tx.fee(Config.FEE_PER_TRANSACTION);
    tx.sign(secretKey);

    return Transaction.fromJson(tx.build());
  }
}

module.exports = exports = Operator;
