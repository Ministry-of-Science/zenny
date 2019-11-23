"use strict";



//  N A T I V E

import crypto from "crypto";



//  P R O G R A M

class CryptoUtil {
  static hash(any) {
    const anyString = typeof any === "object" ?
      JSON.stringify(any) :
      any.toString();

    const anyHash = crypto
      .createHash("sha256")
      .update(anyString)
      .digest("hex");

    return anyHash;
  }

  static randomId(size = 64) {
    return crypto.randomBytes(Math.floor(size / 2)).toString("hex");
  }
}



//  E X P O R T

export default CryptoUtil;
