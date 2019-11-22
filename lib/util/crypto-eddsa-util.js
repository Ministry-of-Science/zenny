"use strict";



//  N A T I V E

const crypto = require("crypto");

//  U T I L S

const elliptic = require("elliptic");
const EDDSA = elliptic.eddsa;
const ec = new EDDSA("ed25519");
const SALT = "0ffaa74d206930aaece253f090c88dbe6685b9e66ec49ad988d84fd7dff230d1";



//  P R O G R A M

class CryptoEDDSAUtil {
  static generateKeyPairFromSecret(secret) {
    // Create key pair from secret
    const keyPair = ec.keyFromSecret(secret); // hex string, array or Buffer

    console.debug(`Public key: \n${elliptic.utils.toHex(keyPair.getPublic())}`);
    return keyPair;
  }

  static generateSecret(password) {
    const secret = crypto.pbkdf2Sync(password, SALT, 10000, 512, "sha512").toString("hex");

    console.debug(`Secret: \n${secret}`);
    return secret;
  }

  static signHash(keyPair, messageHash) {
    const signature = keyPair
      .sign(messageHash)
      .toHex()
      .toLowerCase();

    console.debug(`Signature: \n${signature}`);
    return signature;
  }

  static toHex(data) {
    return elliptic.utils.toHex(data);
  }

  static verifySignature(publicKey, signature, messageHash) {
    const key = ec.keyFromPublic(publicKey, "hex");
    const verified = key.verify(messageHash, signature);

    console.debug(`Verified: ${verified}`);
    return verified;
  }
}



//  E X P O R T

module.exports = exports = CryptoEDDSAUtil;
