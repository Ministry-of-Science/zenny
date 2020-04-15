"use strict";



//  I M P O R T

import statuses from "statuses";

//  U T I L

import ExtendedError from "../util/extended-error.js";



//  P R O G R A M

class HTTPError extends ExtendedError {
  constructor(status, message, context, original) {
    if (!message)
      message = `${status} - ${statuses[status]}`;

    super(message, context, original);

    if (status)
      this.status = status;
  }

  toJSON() {
    const { status } = this;
    return Object.assign({ status }, this); // eslint-disable-line padding-line-between-statements
  }
}



//  E X P O R T

export default HTTPError;
