"use strict";



//  I M P O R T

import ExtendableError from "es6-error";



//  P R O G R A M

class ExtendedError extends ExtendableError {
  constructor(message, context, original) {
    super(message);

    if (context)
      this.context = context;

    if (original)
      this.original = original;
  }

  toJSON() {
    const { message, type, stack, context, original } = this;
    return Object.assign({ message, type, stack, context, original }, this); // eslint-disable-line padding-line-between-statements
  }
}



//  E X P O R T

export default ExtendedError;
