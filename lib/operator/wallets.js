"use strict";



//  I M P O R T

import R from "ramda";

//  U T I L

import Wallet from "./wallet";



//  P R O G R A M

class Wallets extends Array {
  static fromJson(data) {
    const wallets = new Wallets();

    R.forEach((wallet) => { wallets.push(Wallet.fromJson(wallet)); }, data);
    return wallets;
  }
}



//  E X P O R T

export default Wallets;
