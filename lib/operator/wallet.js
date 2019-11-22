const R = require("ramda");
const CryptoUtil = require("../util/crypto-util");
const CryptoEdDSAUtil = require("../util/crypto-eddsa-util");

class Wallet {
  constructor() {
    this.id = null;
    this.passwordHash = null;
    this.secret = null;
    this.keyPairs = [];
  }

  generateAddress() {
    // If secret is null means it is a brand new wallet
    if (this.secret == null)
      this.generateSecret();


    const lastKeyPair = R.last(this.keyPairs);

    // Generate next seed based on the first secret or a new secret from the last key pair.
    const seed = (lastKeyPair == null ? this.secret : CryptoEdDSAUtil.generateSecret(R.propOr(null, "secretKey", lastKeyPair)));
    const keyPairRaw = CryptoEdDSAUtil.generateKeyPairFromSecret(seed);
    const newKeyPair = {
      index: this.keyPairs.length + 1,
      secretKey: CryptoEdDSAUtil.toHex(keyPairRaw.getSecret()),
      publicKey: CryptoEdDSAUtil.toHex(keyPairRaw.getPublic())
    };

    this.keyPairs.push(newKeyPair);
    return newKeyPair.publicKey;
  }

  generateSecret() {
    this.secret = CryptoEdDSAUtil.generateSecret(this.passwordHash);
    return this.secret;
  }

  getAddressByIndex(index) {
    return R.propOr(null, "publicKey", R.find(R.propEq("index", index), this.keyPairs));
  }

  getAddressByPublicKey(publicKey) {
    return R.propOr(null, "publicKey", R.find(R.propEq("publicKey", publicKey), this.keyPairs));
  }

  getSecretKeyByAddress(address) {
    return R.propOr(null, "secretKey", R.find(R.propEq("publicKey", address), this.keyPairs));
  }

  getAddresses() {
    return R.map(R.prop("publicKey"), this.keyPairs);
  }

  static fromPassword(password) {
    const wallet = new Wallet();

    wallet.id = CryptoUtil.randomId();
    wallet.passwordHash = CryptoUtil.hash(password);
    return wallet;
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
}

module.exports = exports = Wallet;
