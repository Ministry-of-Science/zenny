"use strict";



//  P A C K A G E

const R = require("ramda");

//  U T I L

const Wallet = require("./wallet");



//  P R O G R A M

class Wallets extends Array {
  static fromJson(data) {
    const wallets = new Wallets();

    R.forEach((wallet) => { wallets.push(Wallet.fromJson(wallet)); }, data);
    return wallets;
  }
}



//  E X P O R T

module.exports = exports = Wallets;
