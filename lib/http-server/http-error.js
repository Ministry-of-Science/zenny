"use strict";



//  P A C K A G E

const statuses = require("statuses");

//  U T I L

const ExtendedError = require("../util/extended-error");



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

module.exports = exports = HTTPError;
