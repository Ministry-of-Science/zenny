"use strict";



//  I M P O R T

import R from "ramda";

//  U T I L S

import CryptoUtil from "../util/crypto-util";
import CryptoEDDSAUtil from "../util/crypto-eddsa-util";



//  P R O G R A M

class Wallet {
  constructor() {
    this.id = null;
    this.passwordHash = null;
    this.secret = null;
    this.keyPairs = [];
  }

  static fromHash(passwordHash) {
    const wallet = new Wallet();

    wallet.id = CryptoUtil.randomId();
    wallet.passwordHash = passwordHash;
    return wallet;
  }

  static fromJson(data) {
    const wallet = new Wallet();

    R.forEachObjIndexed((value, key) => { wallet[key] = value; }, data);
    return wallet;
  }

  static fromPassword(password) {
    const wallet = new Wallet();

    wallet.id = CryptoUtil.randomId();
    wallet.passwordHash = CryptoUtil.hash(password);
    return wallet;
  }

  generateAddress() {
    // If secret is null means it is a brand new wallet
    if (this.secret === null)
      this.generateSecret();

    const lastKeyPair = R.last(this.keyPairs);

    // Generate next seed based on the first secret or a new secret from the last key pair.
    const seed = (
      lastKeyPair === null ?
        this.secret :
        CryptoEDDSAUtil.generateSecret(R.propOr(null, "secretKey", lastKeyPair))
    );

    const keyPairRaw = CryptoEDDSAUtil.generateKeyPairFromSecret(seed);

    const newKeyPair = {
      index: this.keyPairs.length + 1,
      publicKey: CryptoEDDSAUtil.toHex(keyPairRaw.getPublic()),
      secretKey: CryptoEDDSAUtil.toHex(keyPairRaw.getSecret())
    };

    this.keyPairs.push(newKeyPair);
    return newKeyPair.publicKey;
  }

  getAddressByIndex(index) {
    return R.propOr(
      null,
      "publicKey",
      R.find(
        R.propEq("index", index),
        this.keyPairs
      )
    );
  }

  getAddressByPublicKey(publicKey) {
    return R.propOr(
      null,
      "publicKey",
      R.find(
        R.propEq("publicKey", publicKey),
        this.keyPairs
      )
    );
  }

  getAddresses() {
    return R.map(R.prop("publicKey"), this.keyPairs);
  }

  generateSecret() {
    this.secret = CryptoEDDSAUtil.generateSecret(this.passwordHash);
    return this.secret;
  }

  getSecretKeyByAddress(address) {
    return R.propOr(
      null,
      "secretKey",
      R.find(
        R.propEq("publicKey", address),
        this.keyPairs
      )
    );
  }
}



//  E X P O R T

export default Wallet;
